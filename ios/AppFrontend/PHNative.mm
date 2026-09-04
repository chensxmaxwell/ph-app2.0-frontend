#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>
#import <UserNotifications/UserNotifications.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>

@interface PHNative : NSObject <RCTBridgeModule, AVSpeechSynthesizerDelegate>
@end

@interface PHNative ()
@property (nonatomic, strong) AVSpeechSynthesizer *synthesizer;
@property (nonatomic, copy) RCTPromiseResolveBlock speakResolve;
@property (nonatomic, strong) SFSpeechRecognizer *recognizer;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *speechRequest;
@property (nonatomic, strong) SFSpeechRecognitionTask *speechTask;
@property (nonatomic, strong) AVAudioEngine *audioEngine;
@property (nonatomic, copy) NSString *transcript;
@property (nonatomic, assign) BOOL voiceRunning;
@end

@implementation PHNative

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (NSDictionary *)constantsToExport
{
  NSString *path = [[NSBundle mainBundle] pathForResource:@"viewer-page"
                                                   ofType:@"html"
                                              inDirectory:@"avatar-engine"];
  if (!path) {
    path = [[NSBundle mainBundle] pathForResource:@"viewer-page" ofType:@"html"];
  }
  return @{
    @"avatarViewerUrl": path ? [[NSURL fileURLWithPath:path] absoluteString] : [NSNull null],
  };
}

- (NSDictionary *)voiceFail:(NSString *)reason message:(NSString *)message
{
  return @{
    @"ok": @NO,
    @"reason": reason ?: @"start-failed",
    @"message": message ?: @"Could not start the microphone. Try again.",
    @"text": @""
  };
}

- (NSDictionary *)voiceOk:(NSString *)text
{
  return @{
    @"ok": @YES,
    @"text": text ?: @""
  };
}

- (void)teardownVoiceEngine
{
  @try {
    if (self.audioEngine && self.audioEngine.isRunning) {
      [self.audioEngine stop];
    }
    if (self.audioEngine) {
      [self.audioEngine.inputNode removeTapOnBus:0];
    }
  } @catch (__unused NSException *exception) {
  }
  self.audioEngine = nil;
  [self.speechRequest endAudio];
  [self.speechTask cancel];
  self.speechRequest = nil;
  self.speechTask = nil;
  self.voiceRunning = NO;
  @try {
    [[AVAudioSession sharedInstance]
        setActive:NO
     withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
           error:nil];
  } @catch (__unused NSException *exception) {
  }
}

// Voice input leaves the shared session in the Record category, which has no
// output route: the next AVSpeechSynthesizer utterance would be silent. A
// call is hold → recognize → speak, so before speaking move the session to a
// playback category (through the speaker, ducking other apps) and activate it.
- (void)ensurePlaybackAudioSession
{
  @try {
    AVAudioSession *session = [AVAudioSession sharedInstance];
    if ([session.category isEqualToString:AVAudioSessionCategoryRecord]) {
      [session setCategory:AVAudioSessionCategoryPlayback
                      mode:AVAudioSessionModeDefault
                   options:AVAudioSessionCategoryOptionDuckOthers
                     error:nil];
    }
    [session setActive:YES error:nil];
  } @catch (__unused NSException *exception) {
  }
}

RCT_REMAP_METHOD(speak,
                 speak:(NSString *)text
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      if (!self.synthesizer) {
        self.synthesizer = [AVSpeechSynthesizer new];
        self.synthesizer.delegate = self;
      }
      [self ensurePlaybackAudioSession];
      if (self.speakResolve) {
        RCTPromiseResolveBlock pending = self.speakResolve;
        self.speakResolve = nil;
        pending(@YES);
      }
      [self.synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
      NSString *utteranceText = [text isKindOfClass:[NSString class]] ? text : @"";
      if (utteranceText.length == 0) {
        resolve(@YES);
        return;
      }
      self.speakResolve = resolve;
      AVSpeechUtterance *utterance =
          [AVSpeechUtterance speechUtteranceWithString:utteranceText];
      [self.synthesizer speakUtterance:utterance];
    } @catch (__unused NSException *exception) {
      resolve(@NO);
    }
  });
}

RCT_REMAP_METHOD(stopSpeaking,
                 stopSpeakingWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      [self.synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    } @catch (__unused NSException *exception) {
    }
    if (self.speakResolve) {
      RCTPromiseResolveBlock pending = self.speakResolve;
      self.speakResolve = nil;
      pending(@YES);
    }
    resolve(@YES);
  });
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
 didFinishSpeechUtterance:(AVSpeechUtterance *)utterance
{
  if (self.speakResolve) {
    RCTPromiseResolveBlock pending = self.speakResolve;
    self.speakResolve = nil;
    pending(@YES);
  }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer
  didCancelSpeechUtterance:(AVSpeechUtterance *)utterance
{
  if (self.speakResolve) {
    RCTPromiseResolveBlock pending = self.speakResolve;
    self.speakResolve = nil;
    pending(@YES);
  }
}

RCT_REMAP_METHOD(startVoiceInput,
                 startVoiceInputWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self beginVoiceInput:resolve];
  });
}

- (void)beginVoiceInput:(RCTPromiseResolveBlock)resolve
{
  @try {
    [self teardownVoiceEngine];
    self.transcript = @"";

    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
          resolve([self voiceFail:@"permission-denied"
                          message:@"Microphone access is needed to use voice input."]);
          return;
        }
        [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
          dispatch_async(dispatch_get_main_queue(), ^{
            if (!granted) {
              resolve([self voiceFail:@"permission-denied"
                              message:@"Microphone access is needed to use voice input."]);
              return;
            }
            resolve([self startAuthorizedVoiceInput]);
          });
        }];
      });
    }];
  } @catch (__unused NSException *exception) {
    resolve([self voiceFail:@"start-failed"
                    message:@"Could not start the microphone. Try again."]);
  }
}

- (NSDictionary *)startAuthorizedVoiceInput
{
  @try {
    if ([AVAudioSession sharedInstance].recordPermission != AVAudioSessionRecordPermissionGranted) {
      return [self voiceFail:@"permission-denied"
                     message:@"Microphone access is needed to use voice input."];
    }

    SFSpeechRecognizer *recognizer =
        [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale currentLocale]];
    if (!recognizer) {
      recognizer =
          [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"zh-CN"]];
    }
    if (!recognizer) {
      recognizer =
          [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"en-US"]];
    }
    if (!recognizer || !recognizer.isAvailable) {
      return [self voiceFail:@"unavailable"
                     message:@"Voice input is not available on this build."];
    }

    NSError *sessionError = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    if (![session setCategory:AVAudioSessionCategoryRecord
                         mode:AVAudioSessionModeMeasurement
                      options:AVAudioSessionCategoryOptionDuckOthers
                        error:&sessionError]) {
      return [self voiceFail:@"start-failed"
                     message:@"Could not start the microphone. Try again."];
    }
    if (![session setActive:YES error:&sessionError]) {
      return [self voiceFail:@"start-failed"
                     message:@"Could not start the microphone. Try again."];
    }

    AVAudioEngine *engine = [AVAudioEngine new];
    SFSpeechAudioBufferRecognitionRequest *request =
        [SFSpeechAudioBufferRecognitionRequest new];
    request.shouldReportPartialResults = YES;
    if (@available(iOS 13, *)) {
      request.requiresOnDeviceRecognition = NO;
    }

    AVAudioInputNode *input = engine.inputNode;
    AVAudioFormat *format = [input outputFormatForBus:0];
    if (!format || format.sampleRate <= 0) {
      [self teardownVoiceEngine];
      return [self voiceFail:@"unavailable"
                     message:@"Voice input is not available on this build."];
    }

    __weak PHNative *weakSelf = self;
    self.speechTask = [recognizer
        recognitionTaskWithRequest:request
                     resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
                       PHNative *strongSelf = weakSelf;
                       if (!strongSelf) {
                         return;
                       }
                       if (result.bestTranscription.formattedString.length) {
                         strongSelf.transcript = result.bestTranscription.formattedString;
                       }
                       if (error && !result) {
                         strongSelf.voiceRunning = NO;
                       }
                     }];

    [input installTapOnBus:0
                bufferSize:1024
                    format:format
                     block:^(AVAudioPCMBuffer *buffer, __unused AVAudioTime *when) {
                       [request appendAudioPCMBuffer:buffer];
                     }];

    [engine prepare];
    NSError *engineError = nil;
    if (![engine startAndReturnError:&engineError]) {
      [self teardownVoiceEngine];
      return [self voiceFail:@"start-failed"
                     message:@"Could not start the microphone. Try again."];
    }

    self.recognizer = recognizer;
    self.speechRequest = request;
    self.audioEngine = engine;
    self.voiceRunning = YES;
    return [self voiceOk:@""];
  } @catch (__unused NSException *exception) {
    [self teardownVoiceEngine];
    return [self voiceFail:@"start-failed"
                   message:@"Could not start the microphone. Try again."];
  }
}

RCT_REMAP_METHOD(stopVoiceInput,
                 stopVoiceInputWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      NSString *text = self.transcript ?: @"";
      [self teardownVoiceEngine];
      resolve([self voiceOk:text]);
    } @catch (__unused NSException *exception) {
      resolve([self voiceFail:@"start-failed"
                      message:@"Could not start the microphone. Try again."]);
    }
  });
}

RCT_REMAP_METHOD(requestNotifications,
                 requestNotificationsWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert |
                                           UNAuthorizationOptionSound |
                                           UNAuthorizationOptionBadge)
                        completionHandler:^(BOOL granted, NSError *_Nullable error) {
    resolve(@(granted));
  }];
}

RCT_REMAP_METHOD(syncAlarms,
                 syncAlarms:(NSArray *)alarms
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
    NSMutableArray<NSString *> *stale = [NSMutableArray new];
    for (UNNotificationRequest *request in requests) {
      if ([request.identifier hasPrefix:@"ph.alarm."]) {
        [stale addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:stale];

    NSDictionary *weekdayMap = @{
      @"Sun": @1, @"Mon": @2, @"Tue": @3, @"Wed": @4,
      @"Thu": @5, @"Fri": @6, @"Sat": @7
    };

    for (id item in alarms) {
      if (![item isKindOfClass:[NSDictionary class]]) {
        continue;
      }
      NSDictionary *alarm = (NSDictionary *)item;
      if (![alarm[@"enabled"] boolValue]) {
        continue;
      }
      UNMutableNotificationContent *content = [UNMutableNotificationContent new];
      NSString *name = [alarm[@"name"] isKindOfClass:[NSString class]] ? alarm[@"name"] : @"Pleasure House";
      content.title = name.length ? name : @"Pleasure House";
      content.body = @"Time for your scheduled session.";
      content.sound = [UNNotificationSound defaultSound];
      content.userInfo = @{ @"alarmId": [NSString stringWithFormat:@"%@", alarm[@"id"] ?: @""] };

      NSInteger hour = [alarm[@"hour"] integerValue];
      NSInteger minute = [alarm[@"minute"] integerValue];
      NSArray *days = [alarm[@"days"] isKindOfClass:[NSArray class]] ? alarm[@"days"] : @[];

      void (^schedule)(NSInteger, NSString *) = ^(NSInteger weekday, NSString *ident) {
        NSDateComponents *when = [NSDateComponents new];
        when.hour = hour;
        when.minute = minute;
        if (weekday > 0) {
          when.weekday = weekday;
        }
        UNCalendarNotificationTrigger *trigger =
            [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:when repeats:YES];
        UNNotificationRequest *request =
            [UNNotificationRequest requestWithIdentifier:ident content:content trigger:trigger];
        [center addNotificationRequest:request withCompletionHandler:nil];
      };

      NSString *alarmId = [NSString stringWithFormat:@"%@", alarm[@"id"] ?: [[NSUUID UUID] UUIDString]];
      if (days.count == 0) {
        schedule(0, [NSString stringWithFormat:@"ph.alarm.%@", alarmId]);
        continue;
      }
      for (id day in days) {
        NSString *label = [NSString stringWithFormat:@"%@", day];
        NSNumber *weekday = weekdayMap[label];
        if (!weekday) {
          continue;
        }
        schedule(weekday.integerValue,
                 [NSString stringWithFormat:@"ph.alarm.%@.%@", alarmId, label]);
      }
    }
    resolve(@YES);
  }];
}

@end

#pragma mark - Front camera picture-in-picture (video call)

// Live front-camera preview for the video call PiP. Video input only: no
// audio device is ever added, and the session is told not to configure the
// app's AVAudioSession, so the speech recognizer and the synthesizer keep
// the session to themselves. Runs while attached to a window, stops when
// detached. JS gates on UIManager having "PHCameraPreview" before rendering.
//
// Status events: `authorized` (permission granted, session configured),
// `running` (the session started delivering — only this clears the PiP
// copy), `interrupted` (system paused the camera), `denied`, `unavailable`
// (no camera / runtime error, with the reason). TestFlight 1.2 (14) showed
// an empty dark PiP with nothing to say why; every state now reports.
@interface PHCameraPreviewView : UIView
@property (nonatomic, copy) NSString *position;
@property (nonatomic, copy) RCTDirectEventBlock onStatusChange;
@end

@implementation PHCameraPreviewView {
  AVCaptureSession *_session;
  AVCaptureVideoPreviewLayer *_previewLayer;
  dispatch_queue_t _sessionQueue;
  BOOL _requesting;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    self.backgroundColor = [UIColor blackColor];
    self.clipsToBounds = YES;
    _position = @"front";
    _sessionQueue = dispatch_queue_create("house.pleasure.camera-preview",
                                          DISPATCH_QUEUE_SERIAL);
    // Back from Settings after allowing the camera, or from a system
    // interruption: try again without the JS side remounting the view.
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(applicationDidBecomeActive:)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _previewLayer.frame = self.bounds;
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window) {
    [self startPreview];
  } else {
    [self stopPreview];
  }
}

- (void)applicationDidBecomeActive:(__unused NSNotification *)note
{
  if (self.window) {
    [self startPreview];
  }
}

- (void)observeSession:(AVCaptureSession *)session
{
  NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
  [center addObserver:self
             selector:@selector(sessionDidStartRunning:)
                 name:AVCaptureSessionDidStartRunningNotification
               object:session];
  [center addObserver:self
             selector:@selector(sessionRuntimeError:)
                 name:AVCaptureSessionRuntimeErrorNotification
               object:session];
  [center addObserver:self
             selector:@selector(sessionWasInterrupted:)
                 name:AVCaptureSessionWasInterruptedNotification
               object:session];
  [center addObserver:self
             selector:@selector(sessionInterruptionEnded:)
                 name:AVCaptureSessionInterruptionEndedNotification
               object:session];
}

- (void)sessionDidStartRunning:(__unused NSNotification *)note
{
  [self emitStatus:@"running" message:@""];
}

- (void)sessionRuntimeError:(NSNotification *)note
{
  NSError *error = note.userInfo[AVCaptureSessionErrorKey];
  NSString *reason = [error isKindOfClass:[NSError class]] ? error.localizedDescription : nil;
  [self emitStatus:@"unavailable"
           message:reason.length ? reason : @"The camera could not start."];
}

- (void)sessionWasInterrupted:(__unused NSNotification *)note
{
  [self emitStatus:@"interrupted" message:@"Camera paused by the system."];
}

- (void)sessionInterruptionEnded:(__unused NSNotification *)note
{
  [self emitStatus:@"running" message:@""];
}

- (void)emitStatus:(NSString *)status message:(NSString *)message
{
  RCTDirectEventBlock handler = self.onStatusChange;
  if (!handler) {
    return;
  }
  NSDictionary *payload = @{ @"status": status, @"message": message ?: @"" };
  if ([NSThread isMainThread]) {
    handler(payload);
  } else {
    dispatch_async(dispatch_get_main_queue(), ^{
      handler(payload);
    });
  }
}

- (void)startPreview
{
  @try {
    if (_session) {
      AVCaptureSession *session = _session;
      dispatch_async(_sessionQueue, ^{
        if (!session.isRunning) {
          [session startRunning];
        }
      });
      return;
    }
    AVAuthorizationStatus status =
        [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    switch (status) {
      case AVAuthorizationStatusAuthorized:
        [self configureAndRun];
        return;
      case AVAuthorizationStatusNotDetermined: {
        if (_requesting) {
          return;
        }
        _requesting = YES;
        __weak PHCameraPreviewView *weakSelf = self;
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo
                                 completionHandler:^(BOOL granted) {
          dispatch_async(dispatch_get_main_queue(), ^{
            PHCameraPreviewView *strongSelf = weakSelf;
            if (!strongSelf) {
              return;
            }
            strongSelf->_requesting = NO;
            if (!strongSelf.window) {
              return;
            }
            if (granted) {
              [strongSelf configureAndRun];
            } else {
              [strongSelf emitStatus:@"denied"
                             message:@"Camera access is needed for video."];
            }
          });
        }];
        return;
      }
      default:
        [self emitStatus:@"denied" message:@"Camera access is needed for video."];
        return;
    }
  } @catch (__unused NSException *exception) {
    [self emitStatus:@"unavailable" message:@"The camera could not start."];
  }
}

- (void)configureAndRun
{
  @try {
    AVCaptureDevicePosition wanted =
        [self.position isEqualToString:@"back"] ? AVCaptureDevicePositionBack
                                                : AVCaptureDevicePositionFront;
    AVCaptureDevice *device =
        [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInWideAngleCamera
                                           mediaType:AVMediaTypeVideo
                                            position:wanted];
    if (!device) {
      device = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeVideo];
    }
    NSError *error = nil;
    AVCaptureDeviceInput *input =
        device ? [AVCaptureDeviceInput deviceInputWithDevice:device error:&error] : nil;
    AVCaptureSession *session = [AVCaptureSession new];
    // Never let the capture session reconfigure the voice loop's audio session.
    session.automaticallyConfiguresApplicationAudioSession = NO;
    if (!input || ![session canAddInput:input]) {
      [self emitStatus:@"unavailable" message:@"No camera on this device."];
      return;
    }
    [session beginConfiguration];
    if ([session canSetSessionPreset:AVCaptureSessionPreset640x480]) {
      session.sessionPreset = AVCaptureSessionPreset640x480;
    }
    [session addInput:input];
    [session commitConfiguration];

    AVCaptureVideoPreviewLayer *layer =
        [AVCaptureVideoPreviewLayer layerWithSession:session];
    layer.videoGravity = AVLayerVideoGravityResizeAspectFill;
    layer.frame = self.bounds;
    if (layer.connection.isVideoOrientationSupported) {
      layer.connection.videoOrientation = AVCaptureVideoOrientationPortrait;
    }
    [self.layer addSublayer:layer];
    _previewLayer = layer;
    _session = session;
    [self observeSession:session];
    // `running` is posted by the session itself once frames flow; a session
    // that fails to start posts a runtime error instead of staying black.
    dispatch_async(_sessionQueue, ^{
      [session startRunning];
    });
    [self emitStatus:@"authorized" message:@""];
  } @catch (__unused NSException *exception) {
    [self emitStatus:@"unavailable" message:@"The camera could not start."];
  }
}

- (void)stopPreview
{
  AVCaptureSession *session = _session;
  if (!session) {
    return;
  }
  dispatch_async(_sessionQueue, ^{
    if (session.isRunning) {
      [session stopRunning];
    }
  });
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  [self stopPreview];
}

@end

@interface PHCameraPreviewManager : RCTViewManager
@end

@implementation PHCameraPreviewManager

RCT_EXPORT_MODULE(PHCameraPreview)

- (UIView *)view
{
  return [PHCameraPreviewView new];
}

RCT_EXPORT_VIEW_PROPERTY(position, NSString)
RCT_EXPORT_VIEW_PROPERTY(onStatusChange, RCTDirectEventBlock)

@end
