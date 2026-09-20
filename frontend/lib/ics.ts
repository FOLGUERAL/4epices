/**
 * Génération d'un fichier calendrier iCalendar (.ics), importable dans Google Agenda, Apple Calendrier, Outlook.
 * Module pur : aucun accès au DOM. Les heures sont « flottantes » (sans fuseau) : l'agenda les lit en heure locale.
 */

import { parseLocalDate } from '@/lib/swipeEngine';

export interface IcsEvent {
  uid: string;
  /** AAAA-MM-JJ */
  date: string;
  /** HH:MM */
  time: string;
  durationMinutes: number;
  summary: string;
  description?: string;
  url?: string;
}

const CRLF = '\r\n';
const MAX_LINE_BYTES = 75;

/** Échappe les caractères réservés d'une valeur TEXT (RFC 5545). */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Coupe une ligne à 75 octets (UTF-8) maximum ; les suites commencent par une espace. Ne coupe jamais un caractère. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_BYTES) return line;

  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = MAX_LINE_BYTES;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
      limit = MAX_LINE_BYTES - 1; // l'espace de continuation compte dans la limite
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** AAAAMMJJTHHMMSS, en heure locale (sans « Z ») */
function formatFloating(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(
    date.getMinutes()
  )}00`;
}

/** AAAAMMJJTHHMMSSZ, en UTC (DTSTAMP) */
function formatUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function parseStart(event: IcsEvent): Date | null {
  const day = parseLocalDate(event.date);
  const time = /^(\d{2}):(\d{2})$/.exec(event.time);
  if (!day || !time) return null;
  const hours = Number(time[1]);
  const minutes = Number(time[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

/** Construit le contenu du fichier .ics. Les événements dont la date ou l'heure est invalide sont ignorés. */
export function buildIcs(events: IcsEvent[], options: { calendarName: string; now?: Date }): string {
  const now = options.now ?? new Date();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//4epices//Menu de la semaine//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
  ];

  for (const event of events) {
    const start = parseStart(event);
    if (!start) continue;
    const end = new Date(start.getTime() + Math.max(1, event.durationMinutes) * 60_000);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.uid)}`,
      `DTSTAMP:${formatUtc(now)}`,
      `DTSTART:${formatFloating(start)}`,
      `DTEND:${formatFloating(end)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
