import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText, foldLine, type IcsEvent } from '../ics';

const NOW = new Date(Date.UTC(2026, 8, 16, 10, 30, 0));

function event(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: '1-2026-09-17-soir@4epices',
    date: '2026-09-17',
    time: '19:30',
    durationMinutes: 60,
    summary: 'Dîner : Tarte aux poireaux',
    description: 'Recette Tarte aux poireaux sur 4épices',
    url: 'https://4epices.fr/recettes/tarte-aux-poireaux',
    ...overrides,
  };
}

const unfold = (text: string) => text.replace(/\r\n /g, '');

describe('escapeIcsText', () => {
  it('échappe les caractères réservés', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});

describe('foldLine', () => {
  it('laisse intactes les lignes courtes', () => {
    expect(foldLine('SUMMARY:court')).toBe('SUMMARY:court');
  });

  it('coupe à 75 octets et se déplie sans perte, accents compris', () => {
    const line = `SUMMARY:${'Gratin dauphinois à la crème fraîche épaisse et aux herbes, '.repeat(5)}`;
    const folded = foldLine(line);

    const encoder = new TextEncoder();
    for (const part of folded.split('\r\n')) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(folded)).toBe(line);
  });

  it('ne coupe jamais un caractère multi-octets', () => {
    const line = `SUMMARY:${'é🍲'.repeat(40)}`;
    expect(unfold(foldLine(line))).toBe(line);
    expect(foldLine(line)).not.toContain('�');
  });
});

describe('buildIcs', () => {
  it('produit un calendrier valide avec des fins de ligne CRLF', () => {
    const ics = buildIcs([event()], { calendarName: 'Menu 4épices', now: NOW });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:Menu 4épices');
  });

  it('écrit les dates en heure locale flottante et calcule la fin', () => {
    const ics = unfold(buildIcs([event({ durationMinutes: 90 })], { calendarName: 'Menu', now: NOW }));

    expect(ics).toContain('DTSTART:20260917T193000\r\n');
    expect(ics).toContain('DTEND:20260917T210000\r\n');
    expect(ics).toContain('DTSTAMP:20260916T103000Z\r\n');
  });

  it('gère un événement qui se termine le lendemain', () => {
    const ics = buildIcs([event({ time: '23:30', durationMinutes: 60 })], { calendarName: 'Menu', now: NOW });
    expect(ics).toContain('DTEND:20260918T003000');
  });

  it('échappe le titre et garde l’URL telle quelle', () => {
    const ics = unfold(buildIcs([event({ summary: 'Poulet, riz; sauce' })], { calendarName: 'Menu', now: NOW }));

    expect(ics).toContain('SUMMARY:Poulet\\, riz\\; sauce');
    expect(ics).toContain('URL:https://4epices.fr/recettes/tarte-aux-poireaux');
  });

  it('ignore les événements à la date ou à l’heure invalide', () => {
    const ics = buildIcs(
      [event({ date: '2026-02-31' }), event({ time: '25:00' }), event({ time: 'midi' }), event()],
      { calendarName: 'Menu', now: NOW }
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('produit un calendrier vide sans événement', () => {
    const ics = buildIcs([], { calendarName: 'Menu', now: NOW });
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });
});
