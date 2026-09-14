import { Text, Linking, Alert, type TextProps } from 'react-native';
import { type ReactNode } from 'react';
import * as Cellular from 'expo-cellular';

// Mirrors the backend's SYSTEM_PROMPT contract (bot.js / admin-routes.js /
// scripts/generate-content.js): the only markup AI-generated content is
// allowed to use is **bold** for headings/key phrases. Legacy content
// (generated before that rule existed) may still carry "### heading" lines
// — handled here too so old drafts/published rows render fine without
// needing regeneration. Anything else (lists, tables, ...) is explicitly
// forbidden in the prompt and isn't parsed — it shows as plain text as-is.
const BOLD_UNDERLINE = { fontWeight: '700' as const, textDecorationLine: 'underline' as const };
// Bright, not the app's muted brand blue — tappable phone numbers/links
// need to visually announce themselves inside a wall of plain-text answer,
// same as any link color would in a browser.
const LINK_STYLE = { color: '#0EA5E9', fontWeight: '600' as const, textDecorationLine: 'underline' as const };

const URL_RE = /https?:\/\/[^\s)\]]+/g;
// Matches the app's own established phone formats (+976 XXXX XXXX,
// +7 XXX XXX-XX-XX) and international numbers generally.
const PHONE_RE = /\+\d[\d\s-]{5,14}\d/g;

// RN's built-in dataDetectorType opens tel: directly with no JS callback —
// there's no way to intercept the tap to warn about cost first. Doing our
// own regex-based linkification (instead of relying on the OS detector)
// trades a bit of detection recall for the ability to show that warning.
async function dialPhone(rawNumber: string) {
  const digits = rawNumber.replace(/[\s-]/g, '');
  if (digits.startsWith('+976')) {
    try {
      const iso = await Cellular.getIsoCountryCodeAsync();
      if (iso && iso.toLowerCase() !== 'mn') {
        Alert.alert(
          'Международный звонок',
          'Похоже, на вашей SIM-карте не монгольский номер. Звонок на +976 будет международным и может быть платным. Позвонить?',
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Позвонить', onPress: () => Linking.openURL(`tel:${digits}`).catch(() => {}) },
          ]
        );
        return;
      }
    } catch {
      // Cellular API unavailable (web, some simulators) — fall through and dial.
    }
  }
  Linking.openURL(`tel:${digits}`).catch(() => {});
}

function linkifyPlain(text: string, keyPrefix: string): ReactNode[] {
  const matches: { start: number; end: number; type: 'url' | 'phone'; value: string }[] = [];
  for (const m of text.matchAll(URL_RE)) matches.push({ start: m.index!, end: m.index! + m[0].length, type: 'url', value: m[0] });
  for (const m of text.matchAll(PHONE_RE)) matches.push({ start: m.index!, end: m.index! + m[0].length, type: 'phone', value: m[0] });
  matches.sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start < cursor) return; // overlapping match (e.g. phone regex inside a URL) — skip
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    nodes.push(
      <Text
        key={`${keyPrefix}-${i}`}
        style={LINK_STYLE}
        onPress={() => (m.type === 'url' ? Linking.openURL(m.value).catch(() => {}) : dialPhone(m.value))}
      >
        {m.value}
      </Text>
    );
    cursor = m.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length ? nodes : [text];
}

function parseInline(line: string, keyPrefix: string): ReactNode[] {
  return line
    .split(/(\*\*.+?\*\*)/g)
    .filter(Boolean)
    .flatMap<ReactNode>((part, i) => {
      const m = part.match(/^\*\*(.+)\*\*$/);
      return m
        ? [<Text key={`${keyPrefix}-b${i}`} style={BOLD_UNDERLINE}>{m[1]}</Text>]
        : linkifyPlain(part, `${keyPrefix}-${i}`);
    });
}

export default function MarkdownLiteText({ text, ...rest }: TextProps & { text: string }) {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  lines.forEach((line, idx) => {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      nodes.push(<Text key={`h-${idx}`} style={BOLD_UNDERLINE}>{heading[1]}</Text>);
    } else {
      nodes.push(...parseInline(line, `l${idx}`));
    }
    if (idx < lines.length - 1) nodes.push('\n');
  });
  return <Text {...rest}>{nodes}</Text>;
}
