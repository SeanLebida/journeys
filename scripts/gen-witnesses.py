#!/usr/bin/env python3
"""Extra-biblical / secular corroboration: the classic non-Christian testimonia
to Jesus and early Christianity, authored as neutral, dispute-aware Witness
entries. Idempotent.

Framing principle: report what each ancient source attests and what scholars
contest — never "proof". Contested items (Testimonium Flavianum interpolation,
Thallus, Mara bar Serapion) carry 'disputed' confidence + a disputes note;
widely-accepted ones (Josephus on James/the Baptist, Tacitus) are 'high'.
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
]
citations = [{"id": i, "source": en(s), "url": u, "kind": k} for i, s, u, k in CITES]


def wit(id, title, author, work, era, attests, persons, sites, conf, cites, disputes=None):
    o = {"id": id, "title": en(title), "author": en(author), "work": en(work),
         "era": en(era), "attests": en(attests), "confidence": conf,
         "reviewStatus": "self-reviewed", "citations": cites}
    if persons:
        o["personIds"] = persons
    if sites:
        o["siteIds"] = sites
    if disputes:
        o["disputes"] = en(disputes)
    return o


witnesses = [
    wit("witness-josephus-jesus", "Josephus on Jesus (the Testimonium Flavianum)",
        "Flavius Josephus (Jewish historian)", "Antiquities of the Jews 18.3.3", "c. AD 93-94",
        "A passage in Josephus describing Jesus as a wise teacher, condemned to the cross by Pilate, whose followers persisted. It attests, from a Jewish historian, a 1st-century Jesus crucified under Pilate.",
        ["person-jesus", "person-pontius-pilate"], ["site-jerusalem"], "disputed",
        ["cit-wit-josephus-jesus"],
        disputes="The received text contains overtly Christian phrases most scholars judge to be later Christian interpolations. The mainstream view is that Josephus wrote an authentic core later embellished; a minority hold the whole passage is a Christian insertion. Treat the wording, not the existence of a reference, as contested."),
    wit("witness-josephus-james", "Josephus on James, 'brother of Jesus who was called Christ'",
        "Flavius Josephus", "Antiquities of the Jews 20.9.1", "c. AD 93-94",
        "Josephus reports the illegal execution of 'James, the brother of Jesus who was called Christ' under the high priest Ananus (AD 62). This passage is widely accepted as authentic and independently references Jesus.",
        ["person-jesus"], ["site-jerusalem"], "high", ["cit-wit-josephus-james"]),
    wit("witness-josephus-baptist", "Josephus on John the Baptist",
        "Flavius Josephus", "Antiquities of the Jews 18.5.2", "c. AD 93-94",
        "Josephus describes John, called the Baptist, as a good man who exhorted the Jews and was executed by Herod Antipas — an independent, generally-accepted attestation of John and Antipas paralleling the Gospels.",
        [], ["site-baptism-at-the-jordan"], "high", ["cit-wit-josephus-baptist"]),
    wit("witness-tacitus", "Tacitus on 'Christus' and the Christians of Rome",
        "Cornelius Tacitus (Roman senator & historian)", "Annals 15.44", "c. AD 116",
        "Reporting Nero's scapegoating of Christians after the fire of Rome (AD 64), Tacitus notes that 'Christus', from whom the name came, 'suffered the extreme penalty' under Pontius Pilate in the reign of Tiberius — a hostile Roman source confirming the execution under Pilate.",
        ["person-jesus", "person-pontius-pilate"], ["site-rome"], "high", ["cit-wit-tacitus"]),
    wit("witness-pliny", "Pliny the Younger on early Christian worship",
        "Pliny the Younger (Roman governor of Bithynia)", "Letters 10.96 (to Trajan)", "c. AD 112",
        "Pliny asks Trajan how to try Christians, describing their practice of meeting before dawn to sing 'to Christ as to a god' and binding themselves by oath against wrongdoing — an outside snapshot of Christian worship within about 80 years of the crucifixion.",
        [], [], "high", ["cit-wit-pliny"]),
    wit("witness-suetonius", "Suetonius on 'Chrestus' and the Christians",
        "Suetonius (Roman biographer)", "Lives of the Caesars: Claudius 25; Nero 16", "c. AD 121",
        "Suetonius records Claudius expelling Jews from Rome over disturbances 'at the instigation of Chrestus' (cf. Acts 18:2) and Nero punishing Christians. The reports touch the same movement, though the 'Chrestus' reference is debated.",
        [], ["site-rome"], "medium", ["cit-wit-suetonius"]),
    wit("witness-thallus", "Thallus on the darkness (via Julius Africanus)",
        "Thallus (as quoted by Julius Africanus)", "cited in Africanus, Chronography", "1st c.? (quoted 3rd c.)",
        "The 3rd-century Christian writer Julius Africanus claims Thallus explained the darkness at the crucifixion as a solar eclipse. The value of this as an independent witness is heavily disputed.",
        ["person-jesus"], [], "disputed", ["cit-wit-thallus"],
        disputes="Thallus's work is lost; we have only Africanus's second-hand claim about what Thallus said, and even that Thallus mentioned the crucifixion darkness is inference. Its date and relevance are contested; it is at best weak, indirect testimony."),
    wit("witness-mara", "Mara bar Serapion on the 'wise king' of the Jews",
        "Mara bar Serapion (Syriac Stoic)", "Letter to his son", "after AD 73 (dating debated)",
        "A Syriac letter groups the executed 'wise king' of the Jews with Socrates and Pythagoras as sages killed unjustly. Many take this as a non-Christian allusion to Jesus, though it never names him.",
        ["person-jesus"], [], "disputed", ["cit-wit-mara"],
        disputes="The letter never names Jesus, and both its date (anywhere from the 1st to 3rd century) and whether the 'wise king' is Jesus are debated. It is suggestive, not decisive."),
]


def main():
    write("citations.extra.json", upsert(load("citations.extra.json"), citations))
    write("witnesses.extra.json", upsert(load("witnesses.extra.json"), witnesses))
    print(f"witnesses: {len(witnesses)} · new citations: {len(citations)}")


if __name__ == "__main__":
    main()
