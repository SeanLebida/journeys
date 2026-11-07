import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Journey = {
  id: string;
  kind?: string;
  summary: { en: string };
  stops: string[];
};
type Stop = {
  id: string;
  journeyId?: string;
  siteId: string;
  dateRange: { startYear: number };
  scriptureRefs: string[];
  persons?: string[];
  confidence?: string;
  reviewStatus: string;
};

const journeys = JSON.parse(readFileSync('content/journeys.extra.json', 'utf8')) as Journey[];
const apostleJourneys = JSON.parse(readFileSync('content/journeys.apostles.json', 'utf8')) as Journey[];
const extraStops = JSON.parse(readFileSync('content/stops.extra.json', 'utf8')) as Stop[];
const apostleStops = JSON.parse(readFileSync('content/stops.apostles.json', 'utf8')) as Stop[];
const stops = [...extraStops, ...apostleStops];

const forbidden = [
  'site-antioch',
  'site-rome',
  'site-ephesus',
  'site-patmos',
  'site-hierapolis',
  'site-alexandria',
];

describe('journey-apostolic-traditions', () => {
  const journey = journeys.find((j) => j.id === 'journey-apostolic-traditions');

  it('draws only the places the Twelve shared', () => {
    expect(journey?.stops).toEqual(['stop-together-jerusalem', 'stop-together-samaria']);
    const drawn = journey!.stops.map((id) => stops.find((s) => s.id === id));
    expect(drawn.every(Boolean)).toBe(true);
    for (const stop of drawn) {
      expect(forbidden).not.toContain(stop!.siteId);
    }
    expect(drawn[0]!.dateRange.startYear).toBeLessThanOrEqual(drawn[1]!.dateRange.startYear);
  });

  it('names Mark and the later journeys, and cites Acts for both stops', () => {
    expect(journey?.summary.en).toMatch(/Mark/);
    expect(journey?.summary.en).toMatch(/Alexandria/);
    expect(journey?.summary.en).toMatch(/own journey/);
    const jerusalem = stops.find((s) => s.id === 'stop-together-jerusalem');
    const samaria = stops.find((s) => s.id === 'stop-together-samaria');
    expect(jerusalem?.scriptureRefs).toContain('Acts 2:1');
    expect(samaria?.scriptureRefs).toContain('Acts 8:14');
    expect(jerusalem?.persons).toEqual(expect.arrayContaining(['person-peter', 'person-john-apostle']));
    expect(samaria?.persons).toEqual(expect.arrayContaining(['person-peter', 'person-john-apostle']));
    expect(jerusalem?.reviewStatus).not.toBe('scholar-approved');
    expect(samaria?.reviewStatus).not.toBe('scholar-approved');
  });
});

const eleven = [
  'journey-andrew',
  'journey-james-zebedee',
  'journey-john',
  'journey-philip-apostle',
  'journey-bartholomew',
  'journey-thomas',
  'journey-matthew',
  'journey-james-alphaeus',
  'journey-thaddaeus',
  'journey-simon-zealot',
  'journey-matthias',
];

describe('the eleven apostle journeys', () => {
  it('exists, stays in year order, and is not scholar-approved', () => {
    for (const id of eleven) {
      const journey = apostleJourneys.find((j) => j.id === id);
      expect(journey?.kind).toBe('apostolic');
      expect(journey?.stops.length).toBeGreaterThan(0);
      const drawn = journey!.stops.map((stopId) => stops.find((s) => s.id === stopId));
      expect(drawn.every(Boolean)).toBe(true);
      for (let i = 1; i < drawn.length; i++) {
        expect(drawn[i]!.dateRange.startYear).toBeGreaterThanOrEqual(drawn[i - 1]!.dateRange.startYear);
      }
      for (const stop of drawn) {
        expect(stop!.reviewStatus).not.toBe('scholar-approved');
        if (stop!.scriptureRefs.length === 0) expect(stop!.confidence).not.toBe('high');
      }
    }
  });

  it('keeps Philip the evangelist and Acts 8 off Philip the apostle', () => {
    const journey = apostleJourneys.find((j) => j.id === 'journey-philip-apostle');
    const drawn = journey!.stops.map((stopId) => stops.find((s) => s.id === stopId));
    for (const stop of drawn) {
      expect(stop!.persons ?? []).not.toContain('person-philip-evangelist');
      expect(stop!.scriptureRefs.join(' ')).not.toMatch(/Acts 8:(5|26|40)/);
      expect(stop!.journeyId).toBe('journey-philip-apostle');
    }
    expect(drawn.some((stop) => stop!.siteId === 'site-hierapolis')).toBe(true);
  });

  it('places Ephesus and Patmos after Jerusalem or Samaria on John', () => {
    const journey = apostleJourneys.find((j) => j.id === 'journey-john');
    const drawn = journey!.stops.map((stopId) => stops.find((s) => s.id === stopId));
    expect(drawn.every(Boolean)).toBe(true);
    expect(['site-jerusalem', 'site-samaria']).toContain(drawn[0]!.siteId);
    const later = drawn.findIndex((stop) => stop!.siteId === 'site-ephesus' || stop!.siteId === 'site-patmos');
    expect(later).toBeGreaterThan(0);
    expect(drawn.some((stop) => stop!.siteId === 'site-ephesus')).toBe(true);
    expect(drawn.some((stop) => stop!.siteId === 'site-patmos')).toBe(true);
  });

  it('places Rome last on Peter when Rome is present', () => {
    const journey = journeys.find((j) => j.id === 'journey-peter');
    const drawn = journey!.stops.map((stopId) => stops.find((s) => s.id === stopId));
    expect(drawn.every(Boolean)).toBe(true);
    for (let i = 1; i < drawn.length; i++) {
      expect(drawn[i]!.dateRange.startYear).toBeGreaterThanOrEqual(drawn[i - 1]!.dateRange.startYear);
    }
    const romeAt = drawn.findIndex((stop) => stop!.siteId === 'site-rome');
    expect(romeAt).toBe(drawn.length - 1);
  });

  it('does not put James the brother of the Lord on James son of Alphaeus', () => {
    const journey = apostleJourneys.find((j) => j.id === 'journey-james-alphaeus');
    const drawn = journey!.stops.map((stopId) => stops.find((s) => s.id === stopId));
    for (const stop of drawn) {
      expect(stop!.persons ?? []).not.toContain('person-james-brother-jesus');
      expect(stop!.journeyId).toBe('journey-james-alphaeus');
    }
  });
});
