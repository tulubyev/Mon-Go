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

// Patch .m files that import the missing headers
const M_FILES = [
  '../node_modules/expo-av/ios/EXAV/EXAV.m',
  '../node_modules/expo-av/ios/EXAV/EXAVTV.m',
];

for (const rel of M_FILES) {
  const p = path.join(__dirname, rel);
  if (!fs.existsSync(p)) continue;
  let m = fs.readFileSync(p, 'utf8');
  if (m.includes('POSTINSTALL_PATCHED')) continue;
  const before = m;
  m = m
    .replace('#import <ExpoModulesCore/EXEventEmitter.h>\n', '')
    .replace(
      '#import <ExpoModulesCore/EXEventEmitterService.h>\n',
      '// POSTINSTALL_PATCHED — protocols inlined in EXAV.h\n'
    );
  if (m !== before) {
    fs.writeFileSync(p, m);
    console.log(`[postinstall] Patched ${path.basename(p)}`);
  }
}
