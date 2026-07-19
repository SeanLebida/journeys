#!/usr/bin/env python3
"""The miracle catalogue: every miracle recorded of Jesus in the four Gospels
(the classic list of 37 sign-acts, plus the Gennesaret and Nazareth healing
summaries), and the miracles worked by his disciples in the Gospels and Acts
— each anchored to a mapped site. Idempotent: owns content/miracles.json and
upserts the new sites / persons / citations into the .extra.json layers.

Framing principle (same as the rest of the app): a miracle entry is a
*reported account* — the app presents what the text records and where
tradition/scholarship locates it, with confidence + citations, never "proof".
Location honesty: when the text leaves the spot unnamed (an unnamed Galilean
town, a synagogue on the travel narrative), the entry carries a
`locationNote`, and genuinely contested anchors (the Gerasene shore) are
`disputed` with a disputes note.
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
        json.dump(data, f, ensure_ascii=False, indent=1)
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


# ---------------------------------------------------------------- citations
CITES = [
    ("cit-wikipedia-miracles-of-jesus", "Wikipedia, 'Miracles of Jesus' (survey of the Gospel miracle accounts)", "https://en.wikipedia.org/wiki/Miracles_of_Jesus", "secondary-scholarly"),
    ("cit-blb-miracles-of-jesus", "Blue Letter Bible, 'The Miracles of Jesus' (harmonized study list)", "https://www.blueletterbible.org/study/misc/miracles.cfm", "secondary-scholarly"),
    ("cit-wikipedia-acts-of-the-apostles", "Wikipedia, 'Acts of the Apostles'", "https://en.wikipedia.org/wiki/Acts_of_the_Apostles", "secondary-scholarly"),
    ("cit-wikipedia-nein", "Wikipedia, 'Nein' (the Galilean village identified with NT Nain)", "https://en.wikipedia.org/wiki/Nein", "gazetteer"),
    ("cit-bibleplaces-nain", "BiblePlaces, 'Nain'", "https://www.bibleplaces.com/nain/", "gazetteer"),
    ("cit-wikipedia-lod", "Wikipedia, 'Lod' (ancient Lydda)", "https://en.wikipedia.org/wiki/Lod", "gazetteer"),
    ("cit-wikipedia-jaffa", "Wikipedia, 'Jaffa' (ancient Joppa)", "https://en.wikipedia.org/wiki/Jaffa", "gazetteer"),
    ("cit-wikipedia-gerasene-demoniac", "Wikipedia, 'Exorcism of the Gerasene demoniac' (the Gerasa/Gadara/Gergesa location debate)", "https://en.wikipedia.org/wiki/Exorcism_of_the_Gerasene_demoniac", "secondary-scholarly"),
    ("cit-wikipedia-saint-stephen", "Wikipedia, 'Saint Stephen'", "https://en.wikipedia.org/wiki/Saint_Stephen", "secondary-scholarly"),
    ("cit-wikipedia-philip-the-evangelist", "Wikipedia, 'Philip the Evangelist'", "https://en.wikipedia.org/wiki/Philip_the_Evangelist", "secondary-scholarly"),
    ("cit-wikipedia-ananias-of-damascus", "Wikipedia, 'Ananias of Damascus'", "https://en.wikipedia.org/wiki/Ananias_of_Damascus", "secondary-scholarly"),
]

# ------------------------------------------------------------------- sites
SITES = [
    {
        "id": "site-nain",
        "ancientName": en("Nain"),
        "modernName": en("Nein"),
        "modernLocation": en("Nein, Lower Galilee, Israel — on the northwest slope of the Hill of Moreh, ~12 km south-southeast of Nazareth"),
        "coordinates": {
            "value": {"lat": 32.63028, "lon": 35.34889},
            "confidence": "high",
            "reviewStatus": "self-reviewed",
            "citations": ["cit-wikipedia-nein", "cit-bibleplaces-nain"],
        },
        "summary": en("The Galilean village where Luke records Jesus raising a widow's only son as the funeral procession left the gate (Luke 7:11-17) — the first raising of the dead in the Gospels. The Arab village of Nein preserves the ancient name, and the identification has been continuous since the Byzantine period; a Franciscan chapel marks the traditional spot."),
        "citations": ["cit-wikipedia-nein", "cit-bibleplaces-nain"],
    },
    {
        "id": "site-lydda",
        "ancientName": en("Lydda (Old Testament Lod)"),
        "modernName": en("Lod"),
        "modernLocation": en("Lod, Israel, on the coastal plain ~18 km southeast of Tel Aviv"),
        "coordinates": {
            "value": {"lat": 31.9522, "lon": 34.8896},
            "confidence": "high",
            "reviewStatus": "self-reviewed",
            "citations": ["cit-wikipedia-lod"],
        },
        "summary": en("A town of the Sharon plain (Old Testament Lod, 1 Chronicles 8:12) where Peter, itinerating among the coastal congregations, healed the paralysed Aeneas — 'and all the residents of Lydda and Sharon saw him, and they turned to the Lord' (Acts 9:32-35). Modern Lod continuously preserves the name and site."),
        "citations": ["cit-wikipedia-lod"],
    },
    {
        "id": "site-joppa",
        "ancientName": en("Joppa (Yafo)"),
        "modernName": en("Jaffa"),
        "modernLocation": en("Jaffa (Yafo), the old-city port on the south side of Tel Aviv, Israel; the traditional House of Simon the Tanner stands in the old city"),
        "coordinates": {
            "value": {"lat": 32.05417, "lon": 34.75222},
            "confidence": "high",
            "reviewStatus": "self-reviewed",
            "citations": ["cit-wikipedia-jaffa"],
        },
        "summary": en("The ancient Mediterranean port of Judea (Jonah's embarkation point, Jonah 1:3). In Acts, Peter raised the disciple Tabitha (Dorcas) from death here (Acts 9:36-43), stayed with Simon the tanner, and on the housetop received the vision of the sheet that opened the gospel to the Gentiles (Acts 10). The old city of Jaffa preserves the site."),
        "citations": ["cit-wikipedia-jaffa"],
    },
]

# ----------------------------------------------------------------- persons
PERSONS = [
    {
        "id": "person-stephen",
        "name": en("Stephen"),
        "role": en("One of the Seven; the church's first martyr"),
        "summary": en("Chosen among the Seven to serve the Jerusalem church, 'full of faith and of the Holy Spirit'. Acts records that he 'did great wonders and signs among the people' (Acts 6:8) before his defence to the Sanhedrin and stoning — witnessed by the young Saul of Tarsus."),
        "scriptureRefs": ["Acts 6:5", "Acts 6:8", "Acts 7:59-60"],
        "citations": ["cit-wikipedia-saint-stephen"],
    },
    {
        "id": "person-philip-evangelist",
        "name": en("Philip the Evangelist"),
        "role": en("One of the Seven; evangelist of Samaria and the coast"),
        "summary": en("One of the Seven (distinct from Philip the apostle). Scattered by the persecution after Stephen's death, he proclaimed Christ in Samaria with exorcisms and healings (Acts 8:6-7), baptized the Ethiopian eunuch on the Gaza road, and settled at Caesarea, where Paul later lodged with him (Acts 21:8)."),
        "scriptureRefs": ["Acts 6:5", "Acts 8:6-7", "Acts 8:26", "Acts 21:8-9"],
        "citations": ["cit-wikipedia-philip-the-evangelist"],
    },
    {
        "id": "person-ananias-of-damascus",
        "name": en("Ananias of Damascus"),
        "role": en("Disciple in Damascus who restored Saul's sight"),
        "summary": en("A devout disciple living in Damascus, sent in a vision to the blinded Saul of Tarsus on Straight Street. Laying hands on him, he restored Saul's sight and baptized him (Acts 9:10-19) — the hinge between the persecutor and the apostle."),
        "scriptureRefs": ["Acts 9:10", "Acts 9:17-18", "Acts 22:12-13"],
        "citations": ["cit-wikipedia-ananias-of-damascus"],
    },
]


# ---------------------------------------------------------------- miracles
J_CITES = ["cit-wikipedia-miracles-of-jesus", "cit-blb-miracles-of-jesus"]
A_CITES = ["cit-wikipedia-acts-of-the-apostles"]


def mir(id, title, performed_by, performer_label, kind, site, summary, refs,
        performer_ids=None, location_note=None, conf="medium", cites=None, disputes=None):
    m = {
        "id": id,
        "title": en(title),
        "performedBy": performed_by,
        "performerLabel": en(performer_label),
        "kind": kind,
        "siteId": site,
        "summary": en(summary),
        "scriptureRefs": refs,
        "confidence": conf,
        "reviewStatus": "self-reviewed",
        "citations": cites if cites is not None else (J_CITES if performed_by == "jesus" else A_CITES),
    }
    if performer_ids:
        m["performerIds"] = performer_ids
    if location_note:
        m["locationNote"] = en(location_note)
    if disputes:
        m["disputes"] = en(disputes)
    return m


def jm(id, title, kind, site, summary, refs, **kw):
    kw.setdefault("performer_ids", ["person-jesus"])
    return mir(id, title, "jesus", "Jesus", kind, site, summary, refs, **kw)


def dm(id, title, label, kind, site, summary, refs, **kw):
    return mir(id, title, "disciple", label, kind, site, summary, refs, **kw)


MIRACLES = [
    # ---- The miracles of Jesus — the Galilean ministry ----
    jm("miracle-water-into-wine", "Water turned into wine", "nature", "site-cana-of-galilee",
       "At a wedding feast in Cana of Galilee the water in six stone purification jars became wine — John calls it 'the first of his signs', by which Jesus 'manifested his glory'.",
       ["John 2:1-11"]),
    jm("miracle-officials-son-healed", "The royal official's son healed at a distance", "healing", "site-cana-of-galilee",
       "A royal official from Capernaum begged Jesus, then at Cana, to come heal his dying son; Jesus answered 'Go; your son will live', and the fever left the boy at that very hour — John's second Galilean sign.",
       ["John 4:46-54"],
       location_note="Spoken at Cana; the boy lay ~26 km away in Capernaum and was healed at a distance."),
    jm("miracle-capernaum-demoniac", "The demoniac in the Capernaum synagogue", "exorcism", "site-capernaum",
       "In the synagogue at Capernaum a man with an unclean spirit cried out; Jesus rebuked it — 'Be silent, and come out of him!' — and the spirit left. The first exorcism in Mark's Gospel.",
       ["Mark 1:21-28", "Luke 4:31-37"]),
    jm("miracle-peters-mother-in-law", "Peter's mother-in-law healed", "healing", "site-capernaum",
       "Leaving the synagogue, Jesus took Simon Peter's fever-stricken mother-in-law by the hand and raised her up; the fever left her and she served them. The traditional 'house of Peter' lies a stone's throw from the Capernaum synagogue.",
       ["Mark 1:29-31", "Matthew 8:14-15", "Luke 4:38-39"]),
    jm("miracle-first-catch-of-fish", "The first miraculous catch of fish", "provision", "site-sea-of-galilee",
       "After teaching from Simon's boat, Jesus told the fishermen — who had toiled all night for nothing — to put out into the deep; their nets filled to breaking. Peter fell at his knees, and Jesus called them to fish for people.",
       ["Luke 5:1-11"]),
    jm("miracle-cleansing-a-leper", "A leper cleansed", "healing", "site-capernaum",
       "A leper knelt before Jesus: 'If you will, you can make me clean.' Moved with compassion, Jesus touched him — 'I will; be clean' — and the leprosy left immediately; he was sent to the priest as Moses commanded.",
       ["Mark 1:40-45", "Matthew 8:1-4", "Luke 5:12-16"],
       location_note="Luke places it 'in one of the towns' of Galilee, unnamed; anchored to Capernaum as the hub of this preaching circuit."),
    jm("miracle-centurions-servant", "The centurion's servant healed", "healing", "site-capernaum",
       "A Roman centurion at Capernaum asked healing for his paralysed servant but counted himself unworthy of a visit: 'only say the word'. Jesus marvelled — 'not even in Israel have I found such faith' — and the servant was healed that hour.",
       ["Matthew 8:5-13", "Luke 7:1-10"]),
    jm("miracle-paralytic-through-roof", "The paralytic lowered through the roof", "healing", "site-capernaum",
       "Four friends, blocked by the crowd, dug through the roof of the Capernaum house and lowered a paralysed man to Jesus, who first pronounced his sins forgiven — then, to show the Son of Man's authority to forgive, told him to rise and carry his bed home.",
       ["Mark 2:1-12", "Matthew 9:1-8", "Luke 5:17-26"]),
    jm("miracle-withered-hand", "The man with the withered hand", "healing", "site-capernaum",
       "In a Galilean synagogue on the sabbath, watched by opponents, Jesus asked whether it is lawful to do good or harm on the sabbath, then told the man 'Stretch out your hand' — and it was restored.",
       ["Mark 3:1-6", "Matthew 12:9-14", "Luke 6:6-11"],
       location_note="The synagogue is unnamed; the setting follows the Capernaum ministry in all three Synoptics."),
    jm("miracle-widows-son-nain", "The widow's son at Nain raised", "resurrection", "site-nain",
       "Meeting a funeral at the village gate — a widow's only son — Jesus had compassion, touched the bier and said 'Young man, I say to you, arise.' The dead man sat up and spoke, and Jesus gave him to his mother. The first raising of the dead in the Gospels.",
       ["Luke 7:11-17"]),
    jm("miracle-calming-the-storm", "The storm stilled", "nature", "site-sea-of-galilee",
       "Crossing the lake, a violent squall swamped the boat while Jesus slept on the cushion. Woken — 'Teacher, do you not care that we are perishing?' — he rebuked the wind and said to the sea 'Peace! Be still', and there was a great calm.",
       ["Mark 4:35-41", "Matthew 8:23-27", "Luke 8:22-25"]),
    jm("miracle-gerasene-demoniac", "The Gerasene demoniac ('Legion')", "exorcism", "site-decapolis",
       "On the lake's eastern shore a man living among the tombs, possessed by a 'Legion' of spirits, was delivered; the spirits entered a herd of pigs that rushed down the steep bank into the sea. The healed man became the first herald of the Decapolis.",
       ["Mark 5:1-20", "Matthew 8:28-34", "Luke 8:26-39"],
       conf="disputed",
       disputes="The manuscripts read variously 'Gerasenes', 'Gadarenes', and 'Gergesenes'; Gerasa and Gadara both lie miles from the lake, so many scholars and Byzantine tradition favour Kursi (Gergesa) on the eastern shore, where the bank drops steeply to the water. The event's anchor here spans that debate.",
       cites=J_CITES + ["cit-wikipedia-gerasene-demoniac", "cit-en-wikipedia-org-wiki-kursi-sea-of-galilee"]),
    jm("miracle-jairus-daughter", "Jairus's daughter raised", "resurrection", "site-capernaum",
       "Jairus, a synagogue ruler, fell at Jesus' feet for his dying twelve-year-old daughter. Word came that she had died — 'Do not fear, only believe.' Taking her by the hand: 'Talitha cumi' — 'Little girl, I say to you, arise' — and she got up and walked.",
       ["Mark 5:21-43", "Matthew 9:18-26", "Luke 8:40-56"]),
    jm("miracle-woman-with-issue-of-blood", "The woman with the twelve-year haemorrhage", "healing", "site-capernaum",
       "On the way to Jairus's house, a woman who had suffered a discharge of blood twelve years touched the fringe of his garment in the crowd and was instantly healed. Jesus, perceiving power had gone out, told her: 'Daughter, your faith has made you well.'",
       ["Mark 5:25-34", "Matthew 9:20-22", "Luke 8:43-48"]),
    jm("miracle-two-blind-men", "Two blind men healed", "healing", "site-capernaum",
       "Two blind men followed Jesus crying 'Have mercy on us, Son of David.' Indoors he touched their eyes — 'According to your faith be it done to you' — and their sight was restored.",
       ["Matthew 9:27-31"]),
    jm("miracle-mute-demoniac", "The mute demoniac", "exorcism", "site-capernaum",
       "As the blind men left, a demon-oppressed man who could not speak was brought; when the demon was cast out the mute man spoke, and the crowds marvelled: 'Never was anything like this seen in Israel.'",
       ["Matthew 9:32-34"]),
    jm("miracle-blind-mute-demoniac", "The blind and mute demoniac", "exorcism", "site-capernaum",
       "A demon-oppressed man, blind and mute, was healed so that he both spoke and saw — provoking the Beelzebul controversy, to which Jesus answered that a kingdom divided against itself cannot stand.",
       ["Matthew 12:22-28", "Luke 11:14"],
       location_note="Galilean ministry context; the town is not named."),
    jm("miracle-gennesaret-healings", "Healings at Gennesaret", "healing", "site-sea-of-galilee",
       "Landing at Gennesaret on the lake's northwest shore, crowds carried their sick on beds wherever he went — marketplaces, villages, fields — and 'as many as touched' even the fringe of his garment 'were made well'.",
       ["Mark 6:53-56", "Matthew 14:34-36"],
       location_note="The fertile plain of Gennesaret, between Capernaum and Magdala on the northwest shore."),
    jm("miracle-feeding-5000", "Feeding the five thousand", "provision", "site-tabgha",
       "With five barley loaves and two fish, Jesus fed a crowd of five thousand men 'besides women and children' in a desolate place by the lake; twelve baskets of fragments remained. The only miracle before the resurrection recorded in all four Gospels.",
       ["Mark 6:30-44", "Matthew 14:13-21", "Luke 9:10-17", "John 6:1-14"],
       location_note="Luke places it near Bethsaida; Byzantine tradition fixed the commemoration at Tabgha on the northwest shore, where the Church of the Multiplication preserves the ancient loaves-and-fish mosaic.",
       cites=J_CITES + ["cit-tabgha-primacy"]),
    jm("miracle-walking-on-water", "Walking on the sea", "nature", "site-sea-of-galilee",
       "In the fourth watch of the night, the disciples straining at the oars against the wind, Jesus came to them walking on the sea — 'Take heart; it is I. Do not be afraid' — and when he got into the boat the wind ceased.",
       ["Mark 6:45-52", "Matthew 14:22-33", "John 6:16-21"]),
    jm("miracle-syrophoenician-daughter", "The Syrophoenician woman's daughter", "exorcism", "site-tyre-and-sidon",
       "In the region of Tyre a Gentile woman begged deliverance for her demon-oppressed daughter and answered Jesus' hard saying with persistent faith — 'even the dogs under the table eat the children's crumbs.' 'For this statement... the demon has left your daughter.' Healed at a distance.",
       ["Mark 7:24-30", "Matthew 15:21-28"]),
    jm("miracle-deaf-mute-decapolis", "The deaf man with a speech impediment", "healing", "site-decapolis",
       "Returning through the Decapolis, Jesus took a deaf man with a speech impediment aside, put his fingers in his ears, touched his tongue, and sighed 'Ephphatha' — 'Be opened.' His ears were opened and he spoke plainly.",
       ["Mark 7:31-37"]),
    jm("miracle-feeding-4000", "Feeding the four thousand", "provision", "site-decapolis",
       "In the Decapolis, after the crowd had stayed three days with nothing to eat, Jesus — 'I have compassion on the crowd' — fed four thousand from seven loaves and a few small fish; seven baskets of pieces were taken up.",
       ["Mark 8:1-10", "Matthew 15:32-39"]),
    jm("miracle-blind-man-bethsaida", "The blind man of Bethsaida", "healing", "site-bethsaida",
       "At Bethsaida Jesus led a blind man out of the village and healed him in two stages — first 'I see people, but they look like trees, walking', then, after a second touch, he saw everything clearly. The only two-stage healing in the Gospels.",
       ["Mark 8:22-26"]),
    jm("miracle-boy-with-unclean-spirit", "The boy with the convulsing spirit", "exorcism", "site-caesarea-philippi",
       "Descending from the Mount of Transfiguration, Jesus found his disciples unable to help a father's convulsing, self-destructive boy. 'All things are possible for one who believes' — 'I believe; help my unbelief!' — and the spirit was rebuked and driven out.",
       ["Mark 9:14-29", "Matthew 17:14-21", "Luke 9:37-43"],
       location_note="Below the mount of Transfiguration, in the Caesarea Philippi district (Mount Hermon's traditional slopes)."),
    jm("miracle-coin-in-the-fish", "The temple-tax coin in the fish's mouth", "provision", "site-capernaum",
       "Asked at Capernaum whether his teacher paid the half-shekel temple tax, Peter was sent to the lake: 'take the first fish that comes up... you will find a shekel. Take that and give it to them for me and for yourself.'",
       ["Matthew 17:24-27"]),
    # ---- Jerusalem and the south ----
    jm("miracle-bethesda-invalid", "The invalid at the pool of Bethesda", "healing", "site-jerusalem",
       "By the Sheep Gate pool with five roofed colonnades, Jesus told a man an invalid thirty-eight years: 'Get up, take up your bed, and walk' — on a sabbath, igniting the Jerusalem controversy of John 5. The five-porticoed double pool John describes has been excavated near St Anne's church.",
       ["John 5:1-15"],
       cites=J_CITES + ["cit-arch-bethesda"]),
    jm("miracle-man-born-blind", "The man born blind (Siloam)", "healing", "site-jerusalem",
       "Jesus anointed the eyes of a beggar blind from birth with clay and sent him: 'Go, wash in the pool of Siloam.' He came back seeing — and his interrogation before the Pharisees fills John 9. The stepped Second-Temple pool of Siloam was uncovered in 2004.",
       ["John 9:1-12"],
       cites=J_CITES + ["cit-pool-of-siloam"]),
    jm("miracle-crippled-woman", "The woman bent double for eighteen years", "healing", "site-samaria",
       "Teaching in a synagogue on the sabbath, Jesus laid hands on a woman bent double eighteen years — 'Woman, you are freed from your disability' — and she straightened and glorified God; he defended the healing as loosing 'a daughter of Abraham' from her bond.",
       ["Luke 13:10-17"],
       conf="disputed",
       disputes="Luke does not name the synagogue's town; the episode sits in the travel narrative (Luke 9:51-19:27), whose route runs through the Samaria-Perea corridor toward Jerusalem. The anchor here is the narrative region, not an identified place.",
       location_note="An unnamed synagogue on the final journey toward Jerusalem."),
    jm("miracle-man-with-dropsy", "The man with dropsy", "healing", "site-samaria",
       "At a sabbath dinner in the house of a ruler of the Pharisees, Jesus healed a man suffering from dropsy, asking his silent watchers: 'Which of you, having a son or an ox that has fallen into a well on a Sabbath day, will not immediately pull him out?'",
       ["Luke 14:1-6"],
       conf="disputed",
       disputes="The host's town is unnamed; like the bent woman, the scene belongs to Luke's travel narrative through the Samaria-Perea corridor, and the anchor is the narrative region rather than an identified site.",
       location_note="An unnamed Pharisee's house on the final journey toward Jerusalem."),
    jm("miracle-ten-lepers", "The ten lepers cleansed", "healing", "site-samaria",
       "'Between Samaria and Galilee' ten lepers stood at a distance crying for mercy; sent to show themselves to the priests, they were cleansed as they went. Only one — a Samaritan — turned back to give thanks: 'Your faith has made you well.'",
       ["Luke 17:11-19"],
       location_note="On the border of Samaria and Galilee (Luke 17:11); the village is unnamed."),
    jm("miracle-raising-lazarus", "Lazarus raised from the dead", "resurrection", "site-bethany-and-bethphage",
       "At Bethany, four days after burial, Jesus wept at the tomb of his friend, had the stone removed, and cried 'Lazarus, come out' — and the dead man came out bound in linen strips. John presents it as the sign that sealed the plot against Jesus.",
       ["John 11:1-44"],
       cites=J_CITES + ["cit-en-wikipedia-org-wiki-tomb-of-lazarus"]),
    jm("miracle-blind-bartimaeus", "Blind Bartimaeus at Jericho", "healing", "site-final-journey-jericho",
       "Leaving Jericho on the final ascent to Jerusalem, Jesus stopped for a blind beggar crying 'Son of David, have mercy on me!' — 'Go your way; your faith has made you well.' Bartimaeus recovered his sight and followed him on the way. Matthew recalls two blind men.",
       ["Mark 10:46-52", "Matthew 20:29-34", "Luke 18:35-43"]),
    jm("miracle-fig-tree-withered", "The fig tree withered", "judgment", "site-bethany-and-bethphage",
       "On the road from Bethany, Jesus cursed a leafy fig tree that bore no fruit; by the next morning it had withered from the roots — an acted parable of judgment beside the temple cleansing, turned into a lesson on faith and prayer.",
       ["Mark 11:12-14", "Mark 11:20-25", "Matthew 21:18-22"]),
    jm("miracle-malchus-ear", "The high priest's servant's ear healed", "healing", "site-gethsemane",
       "At the arrest in Gethsemane, Peter's sword cut off the right ear of the high priest's servant, Malchus. 'No more of this!' — Jesus touched the ear and healed him: his last recorded miracle before the crucifixion.",
       ["Luke 22:50-51", "John 18:10-11"]),
    jm("miracle-second-catch-of-fish", "The second miraculous catch of fish", "provision", "site-tabgha",
       "After the resurrection, seven disciples fished all night and caught nothing; at dawn a figure on the shore said 'Cast the net on the right side of the boat' — 153 large fish, and the net not torn. 'It is the Lord!' Breakfast on the shore followed, and Peter's threefold restoration.",
       ["John 21:1-14"],
       location_note="By the Sea of Galilee (Tiberias); tradition places the appearance at Tabgha, where the Church of the Primacy of Peter marks the shore.",
       cites=J_CITES + ["cit-tabgha-primacy"]),
    jm("miracle-nazareth-few-sick-healed", "A few sick healed at Nazareth", "healing", "site-nazareth",
       "In his hometown, met with unbelief — 'Is not this the carpenter?' — Jesus 'could do no mighty work there, except that he laid his hands on a few sick people and healed them', and he marvelled at their unbelief.",
       ["Mark 6:1-6", "Matthew 13:53-58"]),

    # ---- Miracles worked by the disciples of Jesus ----
    dm("miracle-mission-of-the-twelve", "The Twelve heal and cast out demons", "The twelve apostles", "healing", "site-capernaum",
       "Sent out two by two with authority over unclean spirits, the Twelve 'cast out many demons and anointed with oil many who were sick and healed them' through the villages of Galilee — the first miracles the Gospels record of the disciples.",
       ["Mark 6:7-13", "Luke 9:1-6", "Matthew 10:1"],
       location_note="Itinerant through the villages of Galilee; anchored to Capernaum, the mission's home base."),
    dm("miracle-peter-walks-on-water", "Peter walks on the water", "Peter", "nature", "site-sea-of-galilee",
       "'Lord, if it is you, command me to come to you on the water.' Peter got out of the boat and walked on the water toward Jesus — until, seeing the wind, he feared and began to sink: 'Lord, save me.' Jesus caught him: 'O you of little faith, why did you doubt?'",
       ["Matthew 14:28-31"],
       performer_ids=["person-peter"],
       location_note="Mid-lake, in the same night crossing as Jesus' walking on the sea.",
       cites=["cit-wikipedia-miracles-of-jesus", "cit-blb-miracles-of-jesus"]),
    dm("miracle-return-of-the-seventy", "The seventy(-two) return with joy", "The seventy(-two) disciples", "exorcism", "site-samaria",
       "The seventy(-two), sent ahead in pairs to every town Jesus was about to enter, healed the sick and returned rejoicing: 'Lord, even the demons are subject to us in your name!' — 'Do not rejoice in this... but rejoice that your names are written in heaven.'",
       ["Luke 10:1-9", "Luke 10:17-20"],
       location_note="Itinerant through the towns of the travel narrative toward Jerusalem; the region, not a single site, is the anchor."),
    dm("miracle-apostles-wonders-jerusalem", "Many wonders and signs through the apostles", "The apostles", "sign", "site-jerusalem",
       "In the first days of the Jerusalem church after Pentecost, 'awe came upon every soul, and many wonders and signs were being done through the apostles'.",
       ["Acts 2:43"]),
    dm("miracle-lame-man-beautiful-gate", "The lame man at the Beautiful Gate", "Peter (with John)", "healing", "site-jerusalem",
       "A man lame from birth, laid daily at the temple's Beautiful Gate, asked alms. 'I have no silver and gold, but what I do have I give to you. In the name of Jesus Christ of Nazareth, rise up and walk!' — he leapt up, walking and praising God in Solomon's Portico.",
       ["Acts 3:1-10"],
       performer_ids=["person-peter"]),
    dm("miracle-ananias-and-sapphira", "The judgment of Ananias and Sapphira", "Peter", "judgment", "site-jerusalem",
       "Ananias and his wife Sapphira sold a field, kept back part of the price, and laid the rest at the apostles' feet as if it were the whole. Confronted by Peter — 'You have not lied to man but to God' — each fell dead in turn, 'and great fear came upon the whole church'.",
       ["Acts 5:1-11"],
       performer_ids=["person-peter"]),
    dm("miracle-peters-shadow", "Signs in Solomon's Portico; Peter's shadow", "The apostles; Peter", "healing", "site-jerusalem",
       "Many signs and wonders were done among the people in Solomon's Portico; the sick were carried into the streets on cots 'that as Peter came by at least his shadow might fall on some of them', and multitudes from the towns around Jerusalem 'were all healed'.",
       ["Acts 5:12-16"],
       performer_ids=["person-peter"]),
    dm("miracle-apostles-freed-from-prison", "The apostles freed from prison", "An angel of the Lord (for the apostles)", "deliverance", "site-jerusalem",
       "Arrested by the high priest's party, the apostles were freed in the night by an angel of the Lord who opened the prison doors — and at daybreak they were found back in the temple, teaching.",
       ["Acts 5:17-25"]),
    dm("miracle-stephen-wonders", "Stephen's great wonders and signs", "Stephen", "sign", "site-jerusalem",
       "Stephen, 'full of grace and power, was doing great wonders and signs among the people' of Jerusalem — the ministry that drew the opposition leading to his defence before the Sanhedrin and his martyrdom.",
       ["Acts 6:8"],
       performer_ids=["person-stephen"],
       cites=A_CITES + ["cit-wikipedia-saint-stephen"]),
    dm("miracle-philip-in-samaria", "Philip's signs in Samaria", "Philip the Evangelist", "healing", "site-samaria",
       "Scattered by persecution, Philip proclaimed Christ in a city of Samaria: unclean spirits came out 'crying with a loud voice', and many paralysed and lame were healed — 'so there was much joy in that city'. Simon the magician himself believed at the sight.",
       ["Acts 8:4-8", "Acts 8:13"],
       performer_ids=["person-philip-evangelist"],
       cites=A_CITES + ["cit-wikipedia-philip-the-evangelist"]),
    dm("miracle-ananias-restores-saul", "Ananias restores Saul's sight", "Ananias of Damascus", "healing", "site-damascus",
       "Sent in a vision to Straight Street, Ananias laid hands on the blinded persecutor: 'Brother Saul, the Lord Jesus... has sent me so that you may regain your sight and be filled with the Holy Spirit.' Something like scales fell from Saul's eyes, and he was baptized.",
       ["Acts 9:10-19"],
       performer_ids=["person-ananias-of-damascus"],
       cites=A_CITES + ["cit-wikipedia-ananias-of-damascus"]),
    dm("miracle-peter-heals-aeneas", "Aeneas healed at Lydda", "Peter", "healing", "site-lydda",
       "Itinerating among the coastal churches, Peter found Aeneas, bedridden with paralysis eight years: 'Aeneas, Jesus Christ heals you; rise and make your bed.' He rose at once, 'and all the residents of Lydda and Sharon... turned to the Lord'.",
       ["Acts 9:32-35"],
       performer_ids=["person-peter"]),
    dm("miracle-peter-raises-tabitha", "Tabitha (Dorcas) raised at Joppa", "Peter", "resurrection", "site-joppa",
       "The disciple Tabitha of Joppa, 'full of good works', died and was laid in an upper room. Summoned from Lydda, Peter knelt, prayed, and said 'Tabitha, arise' — she opened her eyes and sat up, and many in Joppa believed.",
       ["Acts 9:36-43"],
       performer_ids=["person-peter"]),
    dm("miracle-peter-freed-from-prison", "Peter delivered from Herod's prison", "An angel of the Lord (for Peter)", "deliverance", "site-jerusalem",
       "Imprisoned by Herod Agrippa I under four squads of soldiers, Peter — sleeping between two guards, bound with two chains — was woken by an angel; the chains fell off, the iron gate opened of its own accord, and he came knocking at Mary's house to the astonishment of the praying church.",
       ["Acts 12:5-11"],
       performer_ids=["person-peter"]),
    dm("miracle-elymas-blinded", "Elymas the magician blinded", "Paul", "judgment", "site-paphos",
       "At Paphos, before the proconsul Sergius Paulus, the magician Elymas (Bar-Jesus) opposed the message. Paul, filled with the Holy Spirit: 'you will be blind and unable to see the sun for a time' — mist and darkness fell on him, and the proconsul believed.",
       ["Acts 13:6-12"],
       performer_ids=["person-paul"]),
    dm("miracle-signs-at-iconium", "Signs and wonders at Iconium", "Paul and Barnabas", "sign", "site-iconium",
       "At Iconium Paul and Barnabas 'remained for a long time, speaking boldly for the Lord, who bore witness to the word of his grace, granting signs and wonders to be done by their hands'.",
       ["Acts 14:3"],
       performer_ids=["person-paul", "person-barnabas"]),
    dm("miracle-lame-man-lystra", "The man lame from birth at Lystra", "Paul", "healing", "site-lystra",
       "At Lystra a man crippled from birth, who had never walked, listened to Paul. Seeing he had faith to be made well, Paul said in a loud voice 'Stand upright on your feet' — he sprang up and walked, and the crowds took Paul and Barnabas for Hermes and Zeus.",
       ["Acts 14:8-10"],
       performer_ids=["person-paul"],
       cites=A_CITES + ["cit-dth-the-miracle-at-lystra"]),
    dm("miracle-philippi-slave-girl", "The spirit of divination cast out at Philippi", "Paul", "exorcism", "site-philippi",
       "A slave girl with a spirit of divination, whose fortune-telling enriched her owners, followed Paul for days. 'I command you in the name of Jesus Christ to come out of her' — it left that very hour, and her owners' lost profits landed Paul and Silas in prison.",
       ["Acts 16:16-18"],
       performer_ids=["person-paul"]),
    dm("miracle-philippi-earthquake", "The prison shaken open at Philippi", "God (for Paul and Silas)", "deliverance", "site-philippi",
       "At midnight, Paul and Silas praying and singing in the inner prison, a great earthquake shook the foundations; every door opened and every bond came loose — and the jailer, about to fall on his sword, instead asked 'what must I do to be saved?' and was baptized with his household.",
       ["Acts 16:25-34"],
       performer_ids=["person-paul", "person-silas"]),
    dm("miracle-ephesus-handkerchiefs", "Extraordinary miracles at Ephesus", "Paul", "healing", "site-ephesus",
       "At Ephesus 'God was doing extraordinary miracles by the hands of Paul, so that even handkerchiefs or aprons that had touched his skin were carried away to the sick, and their diseases left them and the evil spirits came out of them' — the backdrop of the seven sons of Sceva episode.",
       ["Acts 19:11-12"],
       performer_ids=["person-paul"]),
    dm("miracle-eutychus-raised", "Eutychus raised at Troas", "Paul", "resurrection", "site-troas",
       "As Paul talked past midnight in the upper room at Troas, the young man Eutychus sank into sleep in the window and fell from the third storey, 'taken up dead'. Paul bent over him and embraced him — 'his life is in him' — and they took the boy away alive, 'not a little comforted'.",
       ["Acts 20:7-12"],
       performer_ids=["person-paul"]),
    dm("miracle-malta-viper", "Unharmed by the viper on Malta", "Paul", "deliverance", "site-malta-shipwreck",
       "Gathering brushwood after the shipwreck, Paul was fastened on by a viper driven out by the heat. The islanders waited for him to swell up or fall dead; he shook the creature into the fire and suffered no harm — and they changed their minds and said he was a god.",
       ["Acts 28:3-6"],
       performer_ids=["person-paul"]),
    dm("miracle-publius-father-healed", "The father of Publius and the sick of Malta healed", "Paul", "healing", "site-malta-shipwreck",
       "Publius, the chief man of Malta, hosted the survivors; his father lay sick with fever and dysentery, and Paul visited him, prayed, laid hands on him and healed him — 'and the rest of the people on the island who had diseases also came and were cured'.",
       ["Acts 28:7-9"],
       performer_ids=["person-paul"]),
]


def main():
    write("miracles.json", MIRACLES)

    cites = [{"id": i, "source": en(s), "url": u, "kind": k} for (i, s, u, k) in CITES]
    write("citations.extra.json", upsert(load("citations.extra.json"), cites))
    write("sites.extra.json", upsert(load("sites.extra.json"), SITES))
    write("persons.extra.json", upsert(load("persons.extra.json"), PERSONS))

    jesus = [m for m in MIRACLES if m["performedBy"] == "jesus"]
    disciples = [m for m in MIRACLES if m["performedBy"] == "disciple"]
    print(f"miracles.json: {len(MIRACLES)} entries ({len(jesus)} of Jesus, {len(disciples)} of the disciples)")
    print(f"upserted {len(SITES)} sites, {len(PERSONS)} persons, {len(cites)} citations")


if __name__ == "__main__":
    main()
