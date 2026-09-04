#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>
#import <UserNotifications/UserNotifications.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>
#import <math.h>

@interface PHNative : NSObject <RCTBridgeModule, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate>
@end

@interface PHNative ()
@property (nonatomic, strong) AVSpeechSynthesizer *synthesizer;
@property (nonatomic, copy) RCTPromiseResolveBlock speakResolve;
@property (nonatomic, strong) AVAudioPlayer *audioPlayer;
@property (nonatomic, copy) RCTPromiseResolveBlock playResolve;
@property (nonatomic, strong) SFSpeechRecognizer *recognizer;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *speechRequest;
@property (nonatomic, strong) SFSpeechRecognitionTask *speechTask;
@property (nonatomic, strong) AVAudioEngine *audioEngine;
// Written on the recognizer's queue, read on main (stopVoiceInput, the
// hands-free tick).
@property (atomic, copy) NSString *transcript;
@property (nonatomic, assign) BOOL voiceRunning;
// Hands-free listening (listenForUtterance): the pending promise, the
// end-pointing clock, and the generation that lets a stop or a newer start
// win over a listen still waiting on the permission prompt.
@property (nonatomic, copy) RCTPromiseResolveBlock listenResolve;
@property (nonatomic, strong) dispatch_source_t listenTimer;
@property (nonatomic, assign) NSUInteger voiceGeneration;
@property (nonatomic, assign) CFAbsoluteTime listenStartedAt;
// Written from the audio tap / the recognizer's queue, read on main.
@property (atomic, assign) CFAbsoluteTime lastVoiceAt;
@property (atomic, assign) CFAbsoluteTime lastTranscriptAt;
@property (nonatomic, assign) NSTimeInterval listenSilence;
@property (nonatomic, assign) NSTimeInterval listenMax;
@property (nonatomic, assign) NSTimeInterval listenIdle;
@end

// RMS (full scale 1.0) above which a buffer counts as the user talking. The
// iPhone mic in Measurement mode sits around 0.002–0.005 in a quiet room and
// well above 0.03 for speech at arm's length; quiet speech that never
// clears the floor is still ended by the transcript going quiet.
static const float PHVoiceRmsFloor = 0.02f;
static const NSTimeInterval PHListenTickInterval = 0.15;

static double PHNumberOption(NSDictionary *options, NSString *key, double fallback)
{
  id value = [options isKindOfClass:[NSDictionary class]] ? options[key] : nil;
  return [value isKindOfClass:[NSNumber class]] ? [(NSNumber *)value doubleValue] : fallback;
}

// Root mean square of the first channel; 0 for a format that is neither
// float32 nor int16 (then only the transcript decides when the user is done).
static float PHBufferRms(AVAudioPCMBuffer *buffer)
{
  AVAudioFrameCount frames = buffer.frameLength;
  if (frames == 0) {
    return 0.0f;
  }
  double sum = 0.0;
  if (buffer.floatChannelData) {
    const float *samples = buffer.floatChannelData[0];
    for (AVAudioFrameCount index = 0; index < frames; index += 1) {
      sum += (double)samples[index] * (double)samples[index];
    }
  } else if (buffer.int16ChannelData) {
    const int16_t *samples = buffer.int16ChannelData[0];
    for (AVAudioFrameCount index = 0; index < frames; index += 1) {
      double sample = samples[index] / 32768.0;
      sum += sample * sample;
    }
  } else {
    return 0.0f;
  }
  return (float)sqrt(sum / (double)frames);
}

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

// What a hands-free listen resolves with when stopVoiceInput or a newer
// start took the mic first: nothing to act on.
- (NSDictionary *)voiceStopped
{
  return @{
    @"ok": @YES,
    @"text": @"",
    @"end": @"stopped"
  };
}

- (void)stopListenTimer
{
  if (self.listenTimer) {
    dispatch_source_cancel(self.listenTimer);
    self.listenTimer = nil;
  }
}

- (void)startListenTimer
{
  [self stopListenTimer];
  dispatch_source_t timer =
      dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
  uint64_t interval = (uint64_t)(PHListenTickInterval * NSEC_PER_SEC);
  dispatch_source_set_timer(timer,
                            dispatch_time(DISPATCH_TIME_NOW, (int64_t)interval),
                            interval,
                            (uint64_t)(0.03 * NSEC_PER_SEC));
  __weak PHNative *weakSelf = self;
  dispatch_source_set_event_handler(timer, ^{
    [weakSelf listenTick];
  });
  dispatch_resume(timer);
  self.listenTimer = timer;
}

// Settles the pending hands-free listen, if any. `end` is utterance / idle /
// stopped; `text` is what the recognizer had at that point.
- (void)settleListen:(NSString *)end text:(NSString *)text
{
  [self stopListenTimer];
  if (self.listenResolve) {
    RCTPromiseResolveBlock pending = self.listenResolve;
    self.listenResolve = nil;
    pending(@{
      @"ok": @YES,
      @"text": text ?: @"",
      @"end": end ?: @"stopped"
    });
  }
}

- (void)finishListen:(NSString *)end
{
  NSString *text = self.transcript ?: @"";
  [self settleListen:end text:text];
  [self teardownVoiceEngine];
}

// Runs on the main queue while a hands-free listen is pending. The user has
// finished when something was recognized and, for silenceMs, no new words
// arrived and the mic stayed under the voice floor; one utterance is capped
// at maxMs. An empty listen ends as idle after idleMs so JS can open the mic
// again under iOS Speech's one-minute request limit.
- (void)listenTick
{
  if (!self.listenResolve) {
    [self stopListenTimer];
    return;
  }
  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  NSTimeInterval sinceStart = now - self.listenStartedAt;
  NSTimeInterval quietFor = now - MAX(self.lastVoiceAt, self.lastTranscriptAt);
  NSString *text = self.transcript ?: @"";
  if (text.length > 0) {
    if (quietFor >= self.listenSilence || sinceStart >= self.listenMax) {
      [self finishListen:@"utterance"];
    }
    return;
  }
  if (sinceStart >= self.listenIdle) {
    [self finishListen:@"idle"];
  }
}

- (void)teardownVoiceEngine
{
  [self stopListenTimer];
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
// The launch default (SoloAmbient) follows the ring/silent switch, so a
// Listen tap on a muted phone was silent too: any category that is not
// already playback-capable is moved to Playback here.
- (void)ensurePlaybackAudioSession
{
  @try {
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSString *category = session.category;
    BOOL playbackCapable =
        [category isEqualToString:AVAudioSessionCategoryPlayback] ||
        [category isEqualToString:AVAudioSessionCategoryPlayAndRecord] ||
        [category isEqualToString:AVAudioSessionCategoryMultiRoute];
    if (!playbackCapable) {
      [session setCategory:AVAudioSessionCategoryPlayback
                      mode:AVAudioSessionModeDefault
                   options:AVAudioSessionCategoryOptionDuckOthers
                     error:nil];
    }
    [session setActive:YES error:nil];
  } @catch (__unused NSException *exception) {
  }
}

- (void)finishPendingSpeak
{
  if (self.speakResolve) {
    RCTPromiseResolveBlock pending = self.speakResolve;
    self.speakResolve = nil;
    pending(@YES);
  }
}

- (void)finishPendingPlay:(BOOL)played
{
  if (self.playResolve) {
    RCTPromiseResolveBlock pending = self.playResolve;
    self.playResolve = nil;
    pending(played ? @YES : @NO);
  }
}

// Stops the cloud-voice player (if any) and settles its promise.
- (void)stopAudioPlayer
{
  @try {
    if (self.audioPlayer) {
      [self.audioPlayer stop];
      self.audioPlayer.delegate = nil;
      self.audioPlayer = nil;
    }
  } @catch (__unused NSException *exception) {
  }
  [self finishPendingPlay:YES];
}

static NSString *PHStringOption(NSDictionary *options, NSString *key)
{
  id value = [options isKindOfClass:[NSDictionary class]] ? options[key] : nil;
  return [value isKindOfClass:[NSString class]] && [(NSString *)value length] > 0
             ? (NSString *)value
             : nil;
}

// The on-device fallback voice. An exact identifier wins; otherwise the best
// installed voice of the wanted gender for the language (exact locale first,
// then the same language, higher quality first); otherwise the language's
// default. Without a gender match the system default is what iOS has —
// Chinese ships Ting-Ting / Yu-shu (female) and Li-mu (male).
- (AVSpeechSynthesisVoice *)voiceForOptions:(NSDictionary *)options
{
  NSString *identifier = PHStringOption(options, @"voiceIdentifier");
  if (identifier) {
    AVSpeechSynthesisVoice *exact = [AVSpeechSynthesisVoice voiceWithIdentifier:identifier];
    if (exact) {
      return exact;
    }
  }
  NSString *language = PHStringOption(options, @"language");
  if (!language) {
    language = [AVSpeechSynthesisVoice currentLanguageCode];
  }
  NSString *gender = [PHStringOption(options, @"gender") lowercaseString];
  AVSpeechSynthesisVoiceGender wanted = AVSpeechSynthesisVoiceGenderUnspecified;
  if ([gender isEqualToString:@"female"]) {
    wanted = AVSpeechSynthesisVoiceGenderFemale;
  } else if ([gender isEqualToString:@"male"]) {
    wanted = AVSpeechSynthesisVoiceGenderMale;
  }
  if (wanted != AVSpeechSynthesisVoiceGenderUnspecified) {
    NSString *primary = [[language componentsSeparatedByString:@"-"] firstObject];
    AVSpeechSynthesisVoice *best = nil;
    NSInteger bestScore = -1;
    for (AVSpeechSynthesisVoice *voice in [AVSpeechSynthesisVoice speechVoices]) {
      if (voice.gender != wanted) {
        continue;
      }
      NSInteger score = -1;
      if ([voice.language caseInsensitiveCompare:language] == NSOrderedSame) {
        score = 20;
      } else if ([[[voice.language componentsSeparatedByString:@"-"] firstObject]
                     caseInsensitiveCompare:primary] == NSOrderedSame) {
        score = 10;
      }
      if (score < 0) {
        continue;
      }
      score += (NSInteger)voice.quality;
      if (score > bestScore) {
        bestScore = score;
        best = voice;
      }
    }
    if (best) {
      return best;
    }
  }
  return [AVSpeechSynthesisVoice voiceWithLanguage:language];
}

RCT_REMAP_METHOD(speak,
                 speak:(NSString *)text
                 options:(NSDictionary *)options
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
      [self stopAudioPlayer];
      [self finishPendingSpeak];
      [self.synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
      NSString *utteranceText = [text isKindOfClass:[NSString class]] ? text : @"";
      if (utteranceText.length == 0) {
        resolve(@YES);
        return;
      }
      self.speakResolve = resolve;
      AVSpeechUtterance *utterance =
          [AVSpeechUtterance speechUtteranceWithString:utteranceText];
      AVSpeechSynthesisVoice *voice = [self voiceForOptions:options];
      if (voice) {
        utterance.voice = voice;
      }
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
    [self stopAudioPlayer];
    [self finishPendingSpeak];
    resolve(@YES);
  });
}

// The cloud voice: base64 MP3 pieces from Doubao TTS, decoded and joined
// here (JS has no byte buffers to concatenate them with), played with
// AVAudioPlayer on the playback session. Resolves YES when playback ends
// (or is stopped), NO when there was nothing playable.
RCT_REMAP_METHOD(playAudio,
                 playAudio:(NSArray *)chunks
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      NSMutableData *data = [NSMutableData new];
      if ([chunks isKindOfClass:[NSArray class]]) {
        for (id chunk in chunks) {
          if (![chunk isKindOfClass:[NSString class]]) {
            continue;
          }
          NSData *piece = [[NSData alloc]
              initWithBase64EncodedString:(NSString *)chunk
                                  options:NSDataBase64DecodingIgnoreUnknownCharacters];
          if (piece.length) {
            [data appendData:piece];
          }
        }
      }
      if (data.length == 0) {
        resolve(@NO);
        return;
      }
      [self ensurePlaybackAudioSession];
      [self.synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
      [self finishPendingSpeak];
      [self stopAudioPlayer];
      NSError *error = nil;
      AVAudioPlayer *player = [[AVAudioPlayer alloc] initWithData:data error:&error];
      if (!player || error) {
        resolve(@NO);
        return;
      }
      player.delegate = self;
      self.audioPlayer = player;
      self.playResolve = resolve;
      if (![player play]) {
        self.audioPlayer = nil;
        self.playResolve = nil;
        resolve(@NO);
      }
    } @catch (__unused NSException *exception) {
      resolve(@NO);
    }
  });
}

- (void)audioPlayerDidFinishPlaying:(AVAudioPlayer *)player successfully:(__unused BOOL)flag
{
  if (player == self.audioPlayer) {
    self.audioPlayer = nil;
  }
  [self finishPendingPlay:YES];
}

- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(__unused NSError *)error
{
  if (player == self.audioPlayer) {
    self.audioPlayer = nil;
  }
  [self finishPendingPlay:NO];
}

- (void)speechSynthesizer:(__unused AVSpeechSynthesizer *)synthesizer
 didFinishSpeechUtterance:(__unused AVSpeechUtterance *)utterance
{
  [self finishPendingSpeak];
}

- (void)speechSynthesizer:(__unused AVSpeechSynthesizer *)synthesizer
  didCancelSpeechUtterance:(__unused AVSpeechUtterance *)utterance
{
  [self finishPendingSpeak];
}

// Push-to-talk (the thread composer): open the mic, stopVoiceInput returns
// the transcript.
RCT_REMAP_METHOD(startVoiceInput,
                 startVoiceInputWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self settleListen:@"stopped" text:@""];
    self.voiceGeneration += 1;
    [self beginVoiceInput:resolve generation:self.voiceGeneration];
  });
}

// Hands-free (a call): open the mic and resolve when the user has finished
// talking — `{ ok, text, end: "utterance" | "idle" | "stopped" }`. Options:
// silenceMs (quiet after speech that ends the utterance), maxMs (one
// utterance at most), idleMs (an empty listen ends as idle). The audio
// session is Record while listening, exactly as for push-to-talk; the JS
// loop waits for this to resolve before it speaks the reply, so the
// recognizer and the synthesizer still never run at the same time
// (landmine 22).
RCT_REMAP_METHOD(listenForUtterance,
                 listenForUtterance:(NSDictionary *)options
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self settleListen:@"stopped" text:@""];
    self.listenSilence = PHNumberOption(options, @"silenceMs", 1100) / 1000.0;
    self.listenMax = PHNumberOption(options, @"maxMs", 20000) / 1000.0;
    self.listenIdle = PHNumberOption(options, @"idleMs", 45000) / 1000.0;
    self.voiceGeneration += 1;
    NSUInteger generation = self.voiceGeneration;
    __weak PHNative *weakSelf = self;
    [self beginVoiceInput:^(id result) {
      PHNative *strongSelf = weakSelf;
      NSDictionary *started =
          [result isKindOfClass:[NSDictionary class]] ? (NSDictionary *)result : nil;
      BOOL opened = started != nil && [started[@"ok"] boolValue] && started[@"end"] == nil;
      if (!strongSelf || !opened) {
        // Refused, failed, or superseded while the permission prompt was up.
        resolve(started ?: @{ @"ok": @YES, @"text": @"", @"end": @"stopped" });
        return;
      }
      CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
      strongSelf.listenStartedAt = now;
      strongSelf.lastVoiceAt = now;
      strongSelf.lastTranscriptAt = now;
      strongSelf.listenResolve = resolve;
      [strongSelf startListenTimer];
    } generation:generation];
  });
}

- (void)beginVoiceInput:(RCTPromiseResolveBlock)resolve generation:(NSUInteger)generation
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
            if (generation != self.voiceGeneration) {
              // Stopped or superseded while the prompt was up: never open
              // the mic for a caller that has moved on.
              resolve([self voiceStopped]);
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
    if (@available(iOS 16, *)) {
      request.addsPunctuation = YES;
    }

    AVAudioInputNode *input = engine.inputNode;
    AVAudioFormat *format = [input outputFormatForBus:0];
    if (!format || format.sampleRate <= 0) {
      [self teardownVoiceEngine];
      return [self voiceFail:@"unavailable"
                     message:@"Voice input is not available on this build."];
    }

    // Set before the task exists so a result handler can tell a live request
    // from one already torn down.
    self.recognizer = recognizer;
    self.speechRequest = request;

    __weak PHNative *weakSelf = self;
    self.speechTask = [recognizer
        recognitionTaskWithRequest:request
                     resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
                       PHNative *strongSelf = weakSelf;
                       if (!strongSelf || strongSelf.speechRequest != request) {
                         return;
                       }
                       NSString *text = result.bestTranscription.formattedString;
                       if (text.length && ![text isEqualToString:strongSelf.transcript]) {
                         strongSelf.transcript = text;
                         strongSelf.lastTranscriptAt = CFAbsoluteTimeGetCurrent();
                       }
                       if (error && !result) {
                         strongSelf.voiceRunning = NO;
                         // Hands-free: the recognizer gave up (no speech in
                         // time, network); hand back what it had so the call
                         // can open the mic again.
                         dispatch_async(dispatch_get_main_queue(), ^{
                           if (strongSelf.listenResolve && strongSelf.speechRequest == request) {
                             [strongSelf finishListen:strongSelf.transcript.length ? @"utterance"
                                                                                   : @"idle"];
                           }
                         });
                       }
                     }];

    [input installTapOnBus:0
                bufferSize:1024
                    format:format
                     block:^(AVAudioPCMBuffer *buffer, __unused AVAudioTime *when) {
                       [request appendAudioPCMBuffer:buffer];
                       PHNative *strongSelf = weakSelf;
                       if (strongSelf && PHBufferRms(buffer) > PHVoiceRmsFloor) {
                         strongSelf.lastVoiceAt = CFAbsoluteTimeGetCurrent();
                       }
                     }];

    [engine prepare];
    NSError *engineError = nil;
    if (![engine startAndReturnError:&engineError]) {
      [self teardownVoiceEngine];
      return [self voiceFail:@"start-failed"
                     message:@"Could not start the microphone. Try again."];
    }

    self.audioEngine = engine;
    self.voiceRunning = YES;
    return [self voiceOk:@""];
  } @catch (__unused NSException *exception) {
    [self teardownVoiceEngine];
    return [self voiceFail:@"start-failed"
                   message:@"Could not start the microphone. Try again."];
  }
}

// Closes the mic. Push-to-talk gets the transcript; a hands-free listen
// still pending is settled as `stopped` so its promise never hangs, and a
// listen still waiting on the permission prompt will not open the mic.
RCT_REMAP_METHOD(stopVoiceInput,
                 stopVoiceInputWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      self.voiceGeneration += 1;
      NSString *text = self.transcript ?: @"";
      [self settleListen:@"stopped" text:@""];
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
// The AVCaptureVideoPreviewLayer is this view's own backing layer
// (+layerClass): it is always exactly the view's bounds, in whatever order
// RN lays the view out, with no sublayer whose frame has to be copied by
// hand. TestFlight 1.2 (14) showed an empty dark PiP; 1.2 (15) showed a black
// one with no copy — JS had been told `running` from
// AVCaptureSessionDidStartRunning while nothing painted. The session running
// is not the layer painting: `running` now comes from the layer's own
// `previewing` flag, which is YES only while it renders frames.
//
// Status events: `authorized` (permission granted, session configured),
// `running` (frames are on screen — only this clears the PiP copy),
// `interrupted` (the system paused the camera, or the session stopped behind
// our back), `denied`, `unavailable` (no camera / runtime error, with the
// reason).
@interface PHCameraPreviewView : UIView
@property (nonatomic, copy) NSString *position;
@property (nonatomic, copy) RCTDirectEventBlock onStatusChange;
@property (nonatomic, readonly) AVCaptureVideoPreviewLayer *previewLayer;
@end

static void *PHPreviewingContext = &PHPreviewingContext;

@implementation PHCameraPreviewView {
  AVCaptureSession *_session;
  dispatch_queue_t _sessionQueue;
  BOOL _requesting;
  // Set around our own stopRunning so DidStopRunning is not reported as an
  // interruption.
  BOOL _stoppedByUs;
}

+ (Class)layerClass
{
  return [AVCaptureVideoPreviewLayer class];
}

- (AVCaptureVideoPreviewLayer *)previewLayer
{
  return (AVCaptureVideoPreviewLayer *)self.layer;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if ((self = [super initWithFrame:frame])) {
    self.backgroundColor = [UIColor blackColor];
    self.clipsToBounds = YES;
    _position = @"front";
    _sessionQueue = dispatch_queue_create("house.pleasure.camera-preview",
                                          DISPATCH_QUEUE_SERIAL);
    self.previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
    // `previewing` flips to YES only when frames are being rendered; that,
    // not the session starting, is what clears the PiP copy.
    [self.previewLayer addObserver:self
                        forKeyPath:@"previewing"
                           options:NSKeyValueObservingOptionNew
                           context:PHPreviewingContext];
    // Back from Settings after allowing the camera, or from a system
    // interruption: try again without the JS side remounting the view.
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(applicationDidBecomeActive:)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
  }
  return self;
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

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey, id> *)change
                       context:(void *)context
{
  if (context != PHPreviewingContext) {
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    return;
  }
  // Delivered on whatever thread AVFoundation changed it; emitStatus hops to
  // main. Going dark is reported by the session notifications below.
  if ([change[NSKeyValueChangeNewKey] boolValue]) {
    [self emitStatus:@"running" message:@""];
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
             selector:@selector(sessionDidStopRunning:)
                 name:AVCaptureSessionDidStopRunningNotification
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

// Belt and braces for the KVO above: if the layer was already previewing by
// the time the session says it started, say so.
- (void)emitRunningIfPreviewing
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.previewLayer.isPreviewing) {
      [self emitStatus:@"running" message:@""];
    }
  });
}

- (void)sessionDidStartRunning:(__unused NSNotification *)note
{
  [self emitRunningIfPreviewing];
}

- (void)sessionDidStopRunning:(__unused NSNotification *)note
{
  if (_stoppedByUs) {
    return;
  }
  [self emitStatus:@"interrupted" message:@"Camera paused by the system."];
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
  [self emitRunningIfPreviewing];
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
      _stoppedByUs = NO;
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

// Main thread: create the session and hand it to the layer (UIKit's), then
// configure and start it on the session queue, the way AVCam does. Nothing
// here says `running`; the layer does when it paints.
- (void)configureAndRun
{
  @try {
    AVCaptureDevicePosition wanted =
        [self.position isEqualToString:@"back"] ? AVCaptureDevicePositionBack
                                                : AVCaptureDevicePositionFront;
    AVCaptureSession *session = [AVCaptureSession new];
    // Never let the capture session reconfigure the voice loop's audio session.
    session.automaticallyConfiguresApplicationAudioSession = NO;
    _session = session;
    _stoppedByUs = NO;
    [self observeSession:session];
    self.previewLayer.session = session;

    __weak PHCameraPreviewView *weakSelf = self;
    dispatch_async(_sessionQueue, ^{
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
      if (!input || ![session canAddInput:input]) {
        dispatch_async(dispatch_get_main_queue(), ^{
          PHCameraPreviewView *strongSelf = weakSelf;
          if (!strongSelf || strongSelf->_session != session) {
            return;
          }
          strongSelf.previewLayer.session = nil;
          strongSelf->_session = nil;
          [strongSelf emitStatus:@"unavailable" message:@"No camera on this device."];
        });
        return;
      }
      [session beginConfiguration];
      if ([session canSetSessionPreset:AVCaptureSessionPreset640x480]) {
        session.sessionPreset = AVCaptureSessionPreset640x480;
      }
      [session addInput:input];
      [session commitConfiguration];
      dispatch_async(dispatch_get_main_queue(), ^{
        PHCameraPreviewView *strongSelf = weakSelf;
        if (!strongSelf || strongSelf->_session != session) {
          return;
        }
        AVCaptureConnection *connection = strongSelf.previewLayer.connection;
        if (connection.isVideoOrientationSupported) {
          connection.videoOrientation = AVCaptureVideoOrientationPortrait;
        }
        [strongSelf emitStatus:@"authorized" message:@""];
      });
      [session startRunning];
    });
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
  _stoppedByUs = YES;
  dispatch_async(_sessionQueue, ^{
    if (session.isRunning) {
      [session stopRunning];
    }
  });
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  @try {
    [self.previewLayer removeObserver:self
                           forKeyPath:@"previewing"
                              context:PHPreviewingContext];
  } @catch (__unused NSException *exception) {
  }
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
