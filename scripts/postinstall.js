#!/usr/bin/env node
// expo-av v16 imports ExpoModulesCore/EXEventEmitter.h and
// ExpoModulesCore/EXEventEmitterService.h which were removed in SDK 57.
// This script patches expo-av ObjC headers to define the protocols inline.
const fs = require('fs');
const path = require('path');

const EXAV_H = path.join(__dirname, '../node_modules/expo-av/ios/EXAV/EXAV.h');

const INLINE_PROTOCOLS = `
#ifndef EXEventEmitter_h
#define EXEventEmitter_h
@protocol EXEventEmitter <NSObject>
- (NSArray<NSString *> *)supportedEvents;
- (void)startObserving;
- (void)stopObserving;
@optional
- (NSDictionary *)constantsToExport;
@end
#endif

#ifndef EXEventEmitterService_h
#define EXEventEmitterService_h
@protocol EXEventEmitterService <NSObject>
- (void)sendEventWithName:(NSString *)name body:(id)body;
@end
#endif
`;

if (!fs.existsSync(EXAV_H)) {
  console.log('[postinstall] EXAV.h not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(EXAV_H, 'utf8');

if (content.includes('POSTINSTALL_PATCHED')) {
  console.log('[postinstall] EXAV.h already patched');
  process.exit(0);
}

// Replace the missing import with inline protocol definitions
content = content
  .replace('#import <ExpoModulesCore/EXEventEmitter.h>\n', '')
  .replace(
    '#import <ExpoModulesCore/EXExportedModule.h>',
    '#import <ExpoModulesCore/EXExportedModule.h>\n// POSTINSTALL_PATCHED\n' + INLINE_PROTOCOLS
  );

fs.writeFileSync(EXAV_H, content);
console.log('[postinstall] Patched EXAV.h — inlined EXEventEmitter protocol');

// Also patch EXAV.m which imports EXEventEmitterService.h
const EXAV_M = path.join(__dirname, '../node_modules/expo-av/ios/EXAV/EXAV.m');
if (fs.existsSync(EXAV_M)) {
  let m = fs.readFileSync(EXAV_M, 'utf8');
  if (!m.includes('POSTINSTALL_PATCHED')) {
    m = m.replace(
      '#import <ExpoModulesCore/EXEventEmitterService.h>\n',
      '// POSTINSTALL_PATCHED — EXEventEmitterService.h inlined in EXAV.h\n'
    );
    fs.writeFileSync(EXAV_M, m);
    console.log('[postinstall] Patched EXAV.m — removed EXEventEmitterService.h import');
  }
}
