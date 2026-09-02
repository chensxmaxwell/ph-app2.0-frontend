#import <React/RCTBridgeModule.h>
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
