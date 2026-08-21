#!/usr/bin/env node
// Adds legacy Expo ObjC headers removed from expo-modules-core but still
// imported by expo-av v16. Without these shims the Xcode build fails with
// 'ExpoModulesCore/EXEventEmitter.h' file not found.
const fs = require('fs');
const path = require('path');

const LEGACY_DIR = path.join(
  __dirname,
  '../node_modules/expo-modules-core/ios/Legacy/Protocols'
);

const SHIMS = {
  'EXEventEmitter.h': `
#pragma once
#import <Foundation/Foundation.h>

@protocol EXEventEmitter <NSObject>
- (NSArray<NSString *> *)supportedEvents;
- (void)startObserving;
- (void)stopObserving;
@optional
- (NSDictionary *)constantsToExport;
@end
`,
  'EXEventEmitterService.h': `
#pragma once
#import <Foundation/Foundation.h>

@protocol EXEventEmitterService <NSObject>
- (void)sendEventWithName:(NSString *)name body:(id)body;
@end
`,
};

if (!fs.existsSync(LEGACY_DIR)) {
  console.log('[postinstall] expo-modules-core Legacy/Protocols not found, skipping shims');
  process.exit(0);
}

for (const [filename, content] of Object.entries(SHIMS)) {
  const dest = path.join(LEGACY_DIR, filename);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, content.trimStart());
    console.log(`[postinstall] Created shim: ${filename}`);
  }
}
