#!/usr/bin/env python3
"""Extra-biblical / secular corroboration: the classic non-Christian testimonia
to Jesus and early Christianity, authored as neutral, dispute-aware Witness
entries. Idempotent.

Framing principle: report what each ancient source attests and what scholars
contest — never "proof". Contested items (Testimonium Flavianum interpolation,
Thallus, Mara bar Serapion) carry 'disputed' confidence + a disputes note;
widely-accepted ones (Josephus on James/the Baptist, Tacitus) are 'high'.

Each entry also carries a `biblicalParallel`: the earliest biblical text on the
same subject and its authoring date, so the app can show the timeline — the
biblical account is the EARLIER source (by a generation for Josephus/Tacitus/
Pliny/Suetonius; by well over a century for Thallus, who survives only in a
3rd-c. quotation, and a late-dated Mara bar Serapion). Dates are scholarly
ranges, never false precision.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "content")


def load(name):
    p = os.path.join(C, name)
    return json.load(open(p)) if os.path.exists(p) else []


def write(name, data):
    with open(os.path.join(C, name), "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def en(s):
    return {"en": s}


def dr(a, b, disp):
    return {"startYear": a, "endYear": b, "display": en(disp), "approximate": True}


def upsert(arr, items):
    by = {x["id"]: x for x in arr}
    for it in items:
        by[it["id"]] = it
    out, seen = [], set()
    for x in arr:
        if x["id"] not in seen:
            out.append(by[x["id"]]); seen.add(x["id"])
    for it in items:
        if it["id"] not in seen:
            out.append(it); seen.add(it["id"])
    return out


CITES = [
    ("cit-wit-josephus-jesus", "Josephus, 'Antiquities of the Jews' 18.3.3 (Testimonium Flavianum)", "https://en.wikipedia.org/wiki/Josephus_on_Jesus", "primary-ancient"),
    ("cit-wit-josephus-james", "Josephus, 'Antiquities of the Jews' 20.9.1", "https://en.wikipedia.org/wiki/Josephus_on_Jesus", "primary-ancient"),
    ("cit-wit-josephus-baptist", "Josephus, 'Antiquities of the Jews' 18.5.2", "https://en.wikipedia.org/wiki/John_the_Baptist", "primary-ancient"),
    ("cit-wit-tacitus", "Tacitus, 'Annals' 15.44", "https://en.wikipedia.org/wiki/Tacitus_on_Christ", "primary-ancient"),
    ("cit-wit-pliny", "Pliny the Younger, 'Letters' 10.96", "https://en.wikipedia.org/wiki/Pliny_the_Younger_on_Christians", "primary-ancient"),
    ("cit-wit-suetonius", "Suetonius, 'Lives of the Caesars' (Claudius 25; Nero 16)", "https://en.wikipedia.org/wiki/Suetonius_on_Christians", "primary-ancient"),
    ("cit-wit-thallus", "Thallus, cited by Julius Africanus", "https://en.wikipedia.org/wiki/Thallus_(historian)", "primary-ancient"),
    ("cit-wit-mara", "Mara bar Serapion, 'Letter to his son'", "https://en.wikipedia.org/wiki/Mara_bar_Serapion", "primary-ancient"),
    ("cit-nt-dating", "Wikipedia, 'Dating the Bible' (composition of the New Testament)", "https://en.wikipedia.org/wiki/Dating_the_Bible", "secondary-scholarly"),
]
citations = [{"id": i, "source": en(s), "url": u, "kind": k} for i, s, u, k in CITES]


def wit(id, title, author, work, era, authored, attests, parallel, persons, sites, conf, cites, disputes=None):
    o = {"id": id, "title": en(title), "author": en(author), "work": en(work),
         "era": en(era), "authoredRange": dr(*authored), "attests": en(attests),
         "confidence": conf, "reviewStatus": "self-reviewed", "citations": cites}
    if parallel:
        src, (pa, pb, pdisp), gap = parallel
        o["biblicalParallel"] = {"source": en(src), "range": dr(pa, pb, pdisp), "gapNote": en(gap)}
    if persons:
        o["personIds"] = persons
    if sites:
        o["siteIds"] = sites
    if disputes:
        o["disputes"] = en(disputes)
    return o


# Reused biblical parallels (earliest text on the subject + its date range).
P_JESUS = ("Paul's letters and the four Gospels", (50, 95, "c. AD 50-95 (Paul's letters from the 50s; the Gospels c. 65-95)"))
P_JAMES = ("Paul's letter to the Galatians, and Acts", (48, 90, "c. AD 48-90 (Galatians, naming James, c. 48-55)"))
P_BAPTIST = ("the four Gospels", (65, 95, "c. AD 65-95"))
P_WORSHIP = ("the New Testament letters and Gospels", (50, 95, "c. AD 50-95"))
P_CLAUDIUS = ("Acts (the expulsion under Claudius) and Paul's letters", (50, 90, "c. AD 50-90 (Acts c. 80-90)"))
P_PASSION = ("the Gospel passion narratives", (65, 95, "c. AD 65-95"))

NTC = ["cit-nt-dating"]  # supporting citation for the NT dating figures

witnesses = [
    wit("witness-josephus-jesus", "Josephus on Jesus (the Testimonium Flavianum)",
        "Flavius Josephus (Jewish historian)", "Antiquities of the Jews 18.3.3", "c. AD 93-94",
        (93, 94, "c. AD 93-94"),
        "A passage in Josephus describing Jesus as a wise teacher, condemned to the cross by Pilate, whose followers persisted. It attests, from a Jewish historian, a 1st-century Jesus crucified under Pilate.",
        (*P_JESUS, "The earliest New Testament accounts of Jesus' death — Paul's letters (c. AD 50s) and the Gospels (c. AD 65-95) — precede Josephus (c. AD 93) by roughly a generation."),
        ["person-jesus", "person-pontius-pilate"], ["site-jerusalem"], "disputed",
        ["cit-wit-josephus-jesus"] + NTC,
        disputes="The received text contains overtly Christian phrases most scholars judge to be later Christian interpolations. The mainstream view is that Josephus wrote an authentic core later embellished; a minority hold the whole passage is a Christian insertion. Treat the wording, not the existence of a reference, as contested."),
    wit("witness-josephus-james", "Josephus on James, 'brother of Jesus who was called Christ'",
        "Flavius Josephus", "Antiquities of the Jews 20.9.1", "c. AD 93-94",
        (93, 94, "c. AD 93-94"),
        "Josephus reports the illegal execution of 'James, the brother of Jesus who was called Christ' under the high priest Ananus (AD 62). This passage is widely accepted as authentic and independently references Jesus.",
        (*P_JAMES, "Paul names James, 'the Lord's brother', in Galatians (c. AD 48-55) — some four decades before Josephus wrote (c. AD 93)."),
        ["person-jesus"], ["site-jerusalem"], "high", ["cit-wit-josephus-james"] + NTC),
    wit("witness-josephus-baptist", "Josephus on John the Baptist",
        "Flavius Josephus", "Antiquities of the Jews 18.5.2", "c. AD 93-94",
        (93, 94, "c. AD 93-94"),
        "Josephus describes John, called the Baptist, as a good man who exhorted the Jews and was executed by Herod Antipas — an independent, generally-accepted attestation of John and Antipas paralleling the Gospels.",
        (*P_BAPTIST, "The Gospels (c. AD 65-95) record John the Baptist a generation before Josephus wrote (c. AD 93)."),
        [], ["site-baptism-at-the-jordan"], "high", ["cit-wit-josephus-baptist"] + NTC),
    wit("witness-tacitus", "Tacitus on 'Christus' and the Christians of Rome",
        "Cornelius Tacitus (Roman senator & historian)", "Annals 15.44", "c. AD 116",
        (116, 116, "c. AD 116"),
        "Reporting Nero's scapegoating of Christians after the fire of Rome (AD 64), Tacitus notes that 'Christus', from whom the name came, 'suffered the extreme penalty' under Pontius Pilate in the reign of Tiberius — a hostile Roman source confirming the execution under Pilate.",
        (*P_JESUS, "The New Testament accounts (c. AD 50-95) predate Tacitus (c. AD 116) by a generation or more."),
        ["person-jesus", "person-pontius-pilate"], ["site-rome"], "high", ["cit-wit-tacitus"] + NTC),
    wit("witness-pliny", "Pliny the Younger on early Christian worship",
        "Pliny the Younger (Roman governor of Bithynia)", "Letters 10.96 (to Trajan)", "c. AD 112",
        (112, 112, "c. AD 112"),
        "Pliny asks Trajan how to try Christians, describing their practice of meeting before dawn to sing 'to Christ as to a god' and binding themselves by oath against wrongdoing — an outside snapshot of Christian worship within about 80 years of the crucifixion.",
        (*P_WORSHIP, "Christian worship is described in the New Testament (c. AD 50-95) decades before Pliny's report (c. AD 112)."),
        [], [], "high", ["cit-wit-pliny"] + NTC),
    wit("witness-suetonius", "Suetonius on 'Chrestus' and the Christians",
        "Suetonius (Roman biographer)", "Lives of the Caesars: Claudius 25; Nero 16", "c. AD 121",
        (121, 121, "c. AD 121"),
        "Suetonius records Claudius expelling Jews from Rome over disturbances 'at the instigation of Chrestus' (cf. Acts 18:2) and Nero punishing Christians. The reports touch the same movement, though the 'Chrestus' reference is debated.",
        (*P_CLAUDIUS, "Acts records the Claudius-era expulsion (Acts 18:2, written c. AD 80-90) before Suetonius (c. AD 121)."),
        [], ["site-rome"], "medium", ["cit-wit-suetonius"] + NTC),
    wit("witness-thallus", "Thallus on the darkness (via Julius Africanus)",
        "Thallus (as quoted by Julius Africanus)", "cited in Africanus, Chronography", "1st c.? (surviving quotation c. AD 221)",
        (221, 221, "surviving quotation c. AD 221"),
        "The 3rd-century Christian writer Julius Africanus claims Thallus explained the darkness at the crucifixion as a solar eclipse. The value of this as an independent witness is heavily disputed.",
        (*P_PASSION, "The Gospels (c. AD 65-95) record the crucifixion darkness; Thallus survives only second-hand in Julius Africanus (c. AD 221) — over a century later — the latest and weakest of these witnesses."),
        ["person-jesus"], [], "disputed", ["cit-wit-thallus"] + NTC,
        disputes="Thallus's work is lost; we have only Africanus's second-hand claim about what Thallus said, and even that Thallus mentioned the crucifixion darkness is inference. Its date and relevance are contested; it is at best weak, indirect testimony."),
    wit("witness-mara", "Mara bar Serapion on the 'wise king' of the Jews",
        "Mara bar Serapion (Syriac Stoic)", "Letter to his son", "after AD 73; date debated (possibly 2nd-3rd c.)",
        (73, 260, "after AD 73; possibly 2nd-3rd c."),
        "A Syriac letter groups the executed 'wise king' of the Jews with Socrates and Pythagoras as sages killed unjustly. Many take this as a non-Christian allusion to Jesus, though it never names him.",
        (*P_PASSION, "The Gospels (c. AD 65-95) precede Mara's letter, whose date is debated (possibly 2nd-3rd century) — potentially a century or more later."),
        ["person-jesus"], [], "disputed", ["cit-wit-mara"] + NTC,
        disputes="The letter never names Jesus, and both its date (anywhere from the 1st to 3rd century) and whether the 'wise king' is Jesus are debated. It is suggestive, not decisive."),
]


def main():
    write("citations.extra.json", upsert(load("citations.extra.json"), citations))
    write("witnesses.extra.json", upsert(load("witnesses.extra.json"), witnesses))
    print(f"witnesses: {len(witnesses)} · new citations: {len(citations)}")


if __name__ == "__main__":
    main()
