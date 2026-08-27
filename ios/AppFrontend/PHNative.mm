#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>

@interface PHNative : NSObject <RCTBridgeModule>
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
