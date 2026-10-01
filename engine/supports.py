"""
What is shown after a miss, for the experiment in experiments/2026-10-support-types.md.

Every miss keeps the baseline (her attempt marked, the error named, the rule, how the
word is built). Each word is in one arm, and the arm adds one thing:

  etymology  the language, root and meaning it comes from, and its family
  story      a real sentence from a classic book that uses it, or a short use written
             for her where no good one was found, labelled as written
  say        the word in parts, to be said aloud the way it is spelt
  blend      all three

THE QUOTATIONS. From public-domain British fiction on Project Gutenberg, British so
that the spellings are the ones she is taught. tools/find_quotes.py ranked candidates
and a person chose; `python3 tools/find_quotes.py verify` re-reads every source and
fails unless each one is in its book word for word. A trailing "..." marks where a
long sentence was cut, and nothing else is changed. Sentences about violence, death
or drink, and the racist language some of these books contain, were filtered out
before choosing, and the choices were read one by one.

Two words had only quotations about death or nothing a child would follow
(cemetery, symbol), and twenty had none at all: mostly the hyphenated school words and
words newer than the books. Those have a written use instead.

REVIEW. Drafted by Claude on 1 October 2026. Nothing unreviewed reaches a child
(docs/05 decision 2), so until Peter has read these, REVIEWED stays False, the app
assigns no arms and the experiment does not start.
"""
REVIEWED = False

ARMS = ("etymology", "story", "say", "blend")

BOOKS = {
    11: ("Lewis Carroll", "Alice's Adventures in Wonderland", 1865),
    12: ("Lewis Carroll", "Through the Looking-Glass", 1871),
    16: ("J. M. Barrie", "Peter Pan", 1911),
    35: ("H. G. Wells", "The Time Machine", 1895),
    46: ("Charles Dickens", "A Christmas Carol", 1843),
    105: ("Jane Austen", "Persuasion", 1817),
    113: ("Frances Hodgson Burnett", "The Secret Garden", 1911),
    141: ("Jane Austen", "Mansfield Park", 1814),
    145: ("George Eliot", "Middlemarch", 1871),
    146: ("Frances Hodgson Burnett", "A Little Princess", 1905),
    158: ("Jane Austen", "Emma", 1815),
    161: ("Jane Austen", "Sense and Sensibility", 1811),
    236: ("Rudyard Kipling", "The Jungle Book", 1894),
    271: ("Anna Sewell", "Black Beauty", 1877),
    289: ("Kenneth Grahame", "The Wind in the Willows", 1908),
    308: ("Jerome K. Jerome", "Three Men in a Boat", 1889),
    421: ("Robert Louis Stevenson", "Kidnapped", 1886),
    550: ("George Eliot", "Silas Marner", 1861),
    580: ("Charles Dickens", "The Pickwick Papers", 1837),
    708: ("George MacDonald", "The Princess and the Goblin", 1872),
    730: ("Charles Dickens", "Oliver Twist", 1838),
    766: ("Charles Dickens", "David Copperfield", 1850),
    768: ("Emily Bront\u00eb", "Wuthering Heights", 1847),
    770: ("E. Nesbit", "The Story of the Treasure Seekers", 1899),
    778: ("E. Nesbit", "Five Children and It", 1902),
    786: ("Charles Dickens", "Hard Times", 1854),
    829: ("Jonathan Swift", "Gulliver's Travels", 1726),
    963: ("Charles Dickens", "Little Dorrit", 1857),
    967: ("Charles Dickens", "Nicholas Nickleby", 1839),
    1018: ("Charles Kingsley", "The Water-Babies", 1863),
    1023: ("Charles Dickens", "Bleak House", 1853),
    1260: ("Charlotte Bront\u00eb", "Jane Eyre", 1847),
    1342: ("Jane Austen", "Pride and Prejudice", 1813),
    1400: ("Charles Dickens", "Great Expectations", 1861),
    1661: ("Arthur Conan Doyle", "The Adventures of Sherlock Holmes", 1892),
    1874: ("E. Nesbit", "The Railway Children", 1906),
    1937: ("Rudyard Kipling", "The Second Jungle Book", 1895),
    2781: ("Rudyard Kipling", "Just So Stories", 1902),
    2852: ("Arthur Conan Doyle", "The Hound of the Baskervilles", 1902),
}

QUOTES = {
    "accommodate": (768, "They preferred taking it out of doors, under the trees, and I set a little table to accommodate them."),
    "accompany": (1260, "I answered by inviting him to accompany me on a general inspection of the result of my labours."),
    "according": (1937, "The Jungle People are very busy in the spring, and Mowgli could hear them grunting and screaming and whistling according to their kind."),
    "achieve": (1260, "I honour endurance, perseverance, industry, talent; because these are the means by which men achieve great ends and mount to lofty eminence."),
    "advice": (12, "\u201cI never ask advice about growing,\u201d Alice said indignantly."),
    "advise": (12, "\u201cYou can\u2019t possibly do that,\u201d said the Rose: \u201cI should advise you to walk the other way.\u201d"),
    "aggressive": (308, "And Bill struggles out, a muddy, trampled wreck, and in an unnecessarily aggressive mood..."),
    "amateur": (308, "There is, it must be confessed, something very sad about the early efforts of an amateur in bagpipes."),
    "ancient": (778, "When he got it home it was a Sunday puzzle about ancient Nineveh!"),
    "apparent": (113, "Mary said nothing at all, and Mrs. Medlock looked rather discomfited by her apparent indifference, but, after taking a breath, she went on."),
    "appreciate": (236, "\u201cWell done for a yearling!\u201d said the Sea Lion, who could appreciate good swimming."),
    "attached": (778, "Everyone disagreed with him at the time, and no one attached any importance to the incident."),
    "available": (2852, "A cast of your skull, sir, until the original is available, would be an ornament to any anthropological museum."),
    "average": (1018, "And another, \u201cHow long would it take a school-inspector of average activity to tumble head over heels from London to York?\u201d"),
    "awkward": (16, "That seemed to be everything, and an awkward pause followed."),
    "bargain": (2781, "Then the Man said, \u2018Yes, but he has not made a bargain with me or with all proper Men after me.\u2019"),
    "bruise": (778, "Robert tore down a stocking and showed a purple bruise touched up with red."),
    "calamitous": (145, "Mrs. Bulstrode is anxious for her niece, and I myself should grieve at a calamitous change in your position."),
    "category": (1661, "Well, I have no doubt that this small matter will fall into the same innocent category."),
    "cold-hearted": (161, "Extravagance and vanity had made him cold-hearted and selfish."),
    "committee": (1023, "Sir Leicester, in the library, has fallen asleep for the good of the country over the report of a Parliamentary committee."),
    "communicate": (113, "Having made this discovery she naturally thought it of enough interest to communicate to Colin."),
    "community": (1937, "Angry as he was at the whole breed and community of Man, something jumped up in his throat and made him catch his breath when he looked at the village roofs."),
    "competition": (963, "Little Dorrit thought of the competition that was to be entered upon, and assented very softly."),
    "confidence": (236, "It gave him confidence in himself, and when Teddy came running down the path, Rikki-tikki was ready to be petted."),
    "confident": (16, "They talked of Cinderella, and Tootles was confident that his mother must have been very like her."),
    "conscience": (1937, "He had the good conscience that comes from paying debts; all the Jungle was his friend, and just a little afraid of him."),
    "conscious": (145, "But as he rode home, he began to be more conscious of being ill, than of being melancholy."),
    "controversy": (829, "Many hundred large volumes have been published upon this controversy..."),
    "convenience": (289, "What is my pleasure or convenience compared with that of others!"),
    "correspond": (308, "The diagnosis seems in every case to correspond exactly with all the sensations that I have ever felt."),
    "criticise": (289, "The Mole was a good listener, and Toad, with no one to check his statements or to criticise in an unfriendly spirit, rather let himself go."),
    "curiosity": (11, "He had been looking at Alice for some time with great curiosity, and this was his first speech."),
    "decency": (308, "I was glad to notice that they had sufficient decency left in them to look very foolish."),
    "decent": (289, "If he\u2019d only employ a decent, steady, well-trained animal, pay him good wages, and leave everything to him, he\u2019d get on all right."),
    "definite": (35, "Once or twice I had a feeling of intense fear for which I could perceive no definite reason."),
    "desperate": (12, "Hatta made a desperate effort, and swallowed a large piece of bread-and-butter."),
    "determined": (146, "She knew it would be rude to smile, and she was very determined not to be rude."),
    "develop": (113, "Robins are not like human beings; their muscles are always exercised from the first and so they develop themselves in a natural manner."),
    "device": (158, "This was a device, I suppose, to sport with my curiosity, and exercise my talent of guessing."),
    "devise": (967, "A ride of two hundred and odd miles in severe weather, is one of the best softeners of a hard bed that ingenuity can devise."),
    "dictionary": (778, "And they could not find it in the dictionary either, though they looked."),
    "disastrous": (308, "We felt that to give in to the weather in a climate such as ours would be a most disastrous precedent."),
    "embarrass": (105, "Situated as we are with Lady Dalrymple, cousins, we ought to be very careful not to embarrass her with acquaintance she might not approve."),
    "environment": (35, "An animal perfectly in harmony with its environment is a perfect mechanism."),
    "equipment": (421, "By the time I came back Alan must have told his story; for it seemed understood that I was to fly with him, and they were all busy upon our equipment."),
    "equipped": (16, "In the meantime the boys were gazing very forlornly at Wendy, now equipped with John and Michael for the journey."),
    "especially": (236, "An elephant\u2019s trumpeting is always nasty, especially on a dark night."),
    "exaggerate": (145, "In her need for some manifestation of feeling she was ready to exaggerate her own fault."),
    "excellence": (1342, "I often tell young ladies, that no excellence in music is to be acquired without constant practice."),
    "excellent": (289, "\u201cExcellent and deserving animal!\u201d said the Badger, his mouth full of chicken and trifle."),
    "existence": (146, "One of the most curious things in her new existence was her changed position among the pupils."),
    "expectancy": (786, "Hushed in expectancy, she kept her wary gaze upon the stairs..."),
    "expectant": (1874, "She had the vague, confused, expectant feeling that comes to one's heart in dreams."),
    "explanation": (289, "This explanation, of course, was thoroughly understood by every one present."),
    "familiar": (289, "As the familiar sound broke forth, the old passion seized on Toad and completely mastered him, body and soul."),
    "foreign": (778, "'Is that the Ninevite language?' asked Anthea, who had learned no foreign language at school except French."),
    "forty": (236, "\u201cFor forty years, father and son, we have tended elephants, and we have never heard such moonshine about dances.\u201d"),
    "frantic": (308, "Little mishaps, that you would hardly notice on dry land, drive you nearly frantic with rage, when they occur on the water."),
    "frequently": (271, "Sometimes we had rather rough play, for they would frequently bite and kick as well as gallop."),
    "government": (236, "This running up and down among the hills is not the best Government service."),
    "green-eyed": (1023, "The welcome light soon shines upon the wall, as Krook comes slowly up with his green-eyed cat following at his heels."),
    "guarantee": (1023, "The story has nothing to do with a picture; the housekeeper can guarantee that."),
    "harass": (766, "Why should he go to India, except to harass me?"),
    "hindrance": (1400, "We both did what we had to do without any hindrance, and when we met again at one o\u2019clock reported it done."),
    "hostile": (16, "Nothing horrid was visible in the air, yet their progress had become slow and laboured, exactly as if they were pushing their way through hostile forces."),
    "identity": (421, "\u201cHave you any papers proving your identity?\u201d asked Mr. Rankeillor."),
    "immediate": (708, "As long as they went deeper there was, Curdie judged, no immediate danger."),
    "immediately": (11, "Here one of the guinea-pigs cheered, and was immediately suppressed by the officers of the court."),
    "individual": (963, "I have fully made up my mind that the individual present has not treated me like a gentleman."),
    "innocence": (1400, "I had been waiting for him to see me that I might try to assure him of my innocence."),
    "innocent": (289, "\u201cIt\u2019s about your rowing, I suppose,\u201d said the Rat, with an innocent air."),
    "interfere": (271, "Many folks would have ridden by and said it was not their business to interfere."),
    "interrupt": (16, "\u201cNow don\u2019t interrupt,\u201d he would beg of her."),
    "language": (113, "He could speak robin (which is a quite distinct language not to be mistaken for any other)."),
    "leisure": (770, "\u2018We paid two shillings for the sample and instructions, and it says you can make two pounds a week easily in your leisure time.\u2019"),
    "licence": (967, "\u2018I shall take the usual licence, Mr. Browdie,\u2019 said Nicholas, as he placed a chair for the bride."),
    "license": (963, "Society had said \u2018Let us license them; let us know them.\u2019"),
    "lightning": (708, "The lightning was breaking out of the mountain, too, and flashing up into the cloud."),
    "marvellous": (16, "It was a marvellous imitation."),
    "mischievous": (12, "And you\u2019d have deserved it, you little mischievous darling!"),
    "muscle": (113, "Dickon stood up on the grass and slowly went through a carefully practical but simple series of muscle exercises."),
    "necessary": (146, "If it was necessary to go to her attic for anything, Sara was obliged to light a candle."),
    "neighbour": (580, "Mr. Pickwick was perfectly aware that a tree is a very dangerous neighbour in a thunderstorm."),
    "nuisance": (778, "You kids must learn not to make yourselves a nuisance."),
    "observance": (1400, "Of course I felt my good faith involved in the observance of his request."),
    "observant": (1400, "He had replaced his neckerchief loosely, and had stood, keenly observant of me, biting a long end of it."),
    "obstinate": (113, "She knew she felt contrary again, and obstinate, and she did not care at all."),
    "occupy": (1260, "I then proposed to occupy myself till dinner-time in drawing some little sketches for her use."),
    "occur": (146, "It did not occur to her to feel cross at finding her pet chair occupied by the small, dingy figure."),
    "opportunity": (12, "\u201cThen you\u2019d better not fight to-day,\u201d said Alice, thinking it a good opportunity to make peace."),
    "parliament": (770, "First we had to decide what sort of illness we should like to cure, and a \u2018heated discussion ensued\u2019, like in Parliament."),
    "persuade": (770, "The next day Albert\u2019s uncle took Noel away, before Oswald had time to persuade Alice that we ought to tell him about the sixpence."),
    "physical": (2852, "There was certainly no physical injury of any kind."),
    "pig-headed": (770, "But Noel is a bit pig-headed; it\u2019s his worst fault."),
    "practice": (778, "Of course in this, as in doing Latin proses or getting into mischief, practice makes perfect."),
    "practise": (308, "My friend used to get up early in the morning to practise, but he had to give that plan up, because of his sister."),
    "prejudice": (146, "But I am afraid she has a childish prejudice against it."),
    "privilege": (289, "\u201cSixpence for the privilege of passing by the private road!\u201d"),
    "profession": (766, "I had never been brought up to any profession, and at first I was at a loss what to do for myself."),
    "programme": (1661, "I observe that there is a good deal of German music on the programme, which is rather more to my taste than Italian or French."),
    "pronunciation": (145, "\u201cThese things belong only to pronunciation, which is the least part of grammar,\u201d said Mrs. Garth."),
    "prophecy": (967, "To this prophecy, so agreeable to his ears, Arthur returned no answer than a cackle of great delight."),
    "prophesy": (308, "It tried its best, but the instrument was built so that it couldn\u2019t prophesy fine weather any harder than it did without breaking itself."),
    "re-enter": (768, "I did not hear him re-enter, and in the morning I found he was still away."),
    "recognise": (1874, "They did not recognise the sound of the boots, but everyone was certain that they had heard the voice before."),
    "recommend": (1400, "\u201cIf you can cough any trifle on it up, Pip, I\u2019d recommend you to do it,\u201d said Joe, all aghast."),
    "relevant": (1661, "\u201cI am glad of all details,\u201d remarked my friend, \u201cwhether they seem to you to be relevant or not.\u201d"),
    "restaurant": (308, "We adjourned soon after the first ballet, and wended our way back to the restaurant, where supper was already awaiting us."),
    "rhyme": (1874, "So, one day, when they sat down to lessons, each of them found a little rhyme at its place."),
    "rhythm": (289, "Then as it grew it took a regular rhythm, and he knew it for nothing else but the pat-pat-pat of little feet still a very long way off."),
    "sacrifice": (141, "He leaves Northamptonshire so soon, that even this slight sacrifice cannot be often demanded."),
    "secretary": (967, "\u2018A secretary\u2019s duties are rather difficult to define, perhaps,\u2019 said Nicholas, considering."),
    "shoulder": (16, "Tinker Bell had been asleep on his shoulder, but now he wakened her and sent her on in front."),
    "signature": (1661, "The note was undated, and without either signature or address."),
    "sincere": (105, "The rain was a mere trifle, and Anne was most sincere in preferring a walk with Mr Elliot."),
    "sincerely": (105, "The Admiral does not seem very ill, and I sincerely hope Bath will do him all the good he wants."),
    "soldier": (12, "She thought she had never seen such a strange-looking soldier in all her life."),
    "stomach": (236, "\u201cNo one then is to be feared,\u201d Baloo wound up, patting his big furry stomach with pride."),
    "sufficient": (289, "The Rat came to help him, but their united efforts were not sufficient to right the cart."),
    "suggest": (113, "\u201cI hadn\u2019t really decided to suggest it,\u201d said the doctor, with his slight nervousness."),
    "system": (730, "For the first six months after Oliver Twist was removed, the system was in full operation."),
    "temperature": (829, "I dwelt long upon the fertility of our soil, and the temperature of our climate."),
    "thorough": (16, "How thorough she was at bath-time, and up at any moment of the night if one of her charges made the slightest cry."),
    "tight-fisted": (46, "But he was a tight-fisted hand at the grind-stone, Scrooge! a squeezing, wrenching, grasping, scraping, clutching, covetous, old sinner!"),
    "tolerance": (550, "\u201cAye, but there\u2019s this in it, Dowlas,\u201d said the landlord, speaking in a tone of much candour and tolerance."),
    "tolerant": (963, "It was nothing to her that the kindness took the form of tolerant patronage; she was used to that."),
    "twelfth": (271, "When the twelfth day after the accident came, I was taken to the sale, a few miles out of London."),
    "variety": (1023, "Mr. Snagsby, as a timid man, is accustomed to cough with a variety of expressions, and so to save words."),
    "vegetable": (35, "In the end, wisely and carefully we shall readjust the balance of animal and vegetable life to suit our human needs."),
    "vehicle": (730, "As he walked briskly along the road, he heard behind him, the noise of some vehicle, approaching at a furious pace."),
    "wide-eyed": (145, "Louisa, Mrs. Vincy\u2019s darling, now ran to her with wide-eyed serious excitement..."),
    "yacht": (766, "I must not forget that we went on board the yacht, where they all three descended into the cabin, and were busy with some papers."),
}

# Uses written for her, where no quotation would do. Each is labelled as written.
WRITTEN = {
    "cemetery": "The old cemetery behind the church was full of mossy stones with names you could barely read.",
    "co-author": "Mum and her friend were each a co-author of the cookbook, so both their names went on the cover.",
    "co-operate": "The two teams had to co-operate to get the raft across the river.",
    "co-ordinate": "We had to co-ordinate our steps, or the three-legged race would end in a heap.",
    "co-own": "My brother and I co-own the old bike, so we take turns to ride it.",
    "existent": "The scientists were delighted to find the beetle still existent, long after they thought it had vanished.",
    "hesitancy": "There was a hesitancy in her voice, as if she was not sure she should say it.",
    "hesitant": "Sam was hesitant at the edge of the pool, and then he jumped in.",
    "little-used": "We took a little-used path through the woods, full of brambles and quiet.",
    "man-eating": "The film was about a man-eating shark, but the real sharks we saw were small and shy.",
    "queue": "We stood in a long queue for ice cream on the hottest day of the year.",
    "re-educate": "The rescue centre helped re-educate the young owl so that it could hunt for itself again.",
    "re-elect": "The class voted to re-elect Mia as their school council rep.",
    "re-energise": "A drink of water and a short rest helped re-energise the tired runners.",
    "re-evaluate": "After the first lap, the team stopped to re-evaluate their plan.",
    "re-examine": "The detective decided to re-examine the footprints in the mud.",
    "relevance": "Our teacher asked us to explain the relevance of each picture to the story.",
    "rock-bottom": "The shop sold last year's toys at rock-bottom prices.",
    "short-tempered": "The giant was short-tempered in the mornings, so the children tiptoed past his door.",
    "spectacular": "The fireworks were spectacular, lighting the whole sky in red and gold.",
    "stone-faced": "The guard stood stone-faced, not even blinking, while the visitors took photos.",
    "symbol": "A red cross is a symbol that means help is here.",
}


def etymology_for(entry):
    """Where it comes from, in one line, and up to three of its family."""
    lang, root, gloss = entry.get("lang"), entry.get("root"), entry.get("gloss")
    if not (lang and root and gloss):
        return None
    if lang == "English":
        text = f"Made in English from {root}: {gloss}."
    else:
        text = f"From the {lang} {root}, meaning \u2018{gloss}\u2019."
    return {"text": text, "family": [w for w in entry.get("family", []) if w][:3]}


def _letter_syllables(syll, word):
    """For each letter of the word, the index of its syllable; None if they disagree."""
    chunks = [s for s in syll.split("-") if s]
    if "".join(chunks) != word:
        return None, chunks
    owner = [i for i, c in enumerate(chunks) for _ in c]
    return owner, chunks


def say_for(word, entry, parts=None):
    """The word in pieces to say aloud as it is spelt, and which pieces to lean on.

    Spelling pronunciation: saying a word the way it is written ("obSERVant",
    "Wed-nes-day") helps children learn to spell it (Hilte and Reitsma 2006). A school
    word is said in its parts, the hyphen as a word; a statutory word in its syllables.
    The piece holding the trap is the one to lean on.
    """
    if parts:
        chunks = ["hyphen" if p["text"] == "-" else p["text"] for p in parts]
        if "hyphen" in chunks:
            stress = [chunks.index("hyphen")]
        elif parts[-1]["kind"] == "suffix" or entry.get("traps") == [word]:
            stress = [len(chunks) - 1]
        else:
            trap = (entry.get("traps") or [""])[0]
            stress = [i for i, c in enumerate(chunks) if trap and trap in c][:1]
        return {"chunks": chunks, "stress": stress}
    owner, chunks = _letter_syllables(entry.get("syll", ""), word)
    if not owner:
        return {"chunks": chunks or [word], "stress": []}
    def syllables_of(trap):
        at = word.find(trap)
        return sorted({owner[k] for k in range(at, at + len(trap))}) if at >= 0 else []
    traps = entry.get("traps") or []
    every = sorted({s for t in traps for s in syllables_of(t)})
    stress = every if len(every) * 2 <= len(chunks) else (syllables_of(traps[0]) if traps else [])
    return {"chunks": chunks, "stress": stress}


def story_for(word):
    if word in QUOTES:
        ebook, text = QUOTES[word]
        author, title, year = BOOKS[ebook]
        return {"kind": "quote", "text": text, "source": f"{author}, {title}, {year}",
                "ebook": ebook}
    if word in WRITTEN:
        return {"kind": "written", "text": WRITTEN[word], "source": "Written for you"}
    return None


def build(curated, term_entries, term_parts, off_list):
    """The supports for every word in the experiment, for web/data/supports.json."""
    entries = {e["word"]: e for e in curated}
    entries.update({e["word"]: e for e in term_entries if e["word"] not in entries})
    words = {}
    for word in sorted(entries):
        if word in off_list:
            continue
        e = entries[word]
        words[word] = {
            "etymology": etymology_for(e),
            "story": story_for(word),
            "say": say_for(word, e, term_parts.get(word)),
        }
    return {
        "generated_by": "engine/supports.py",
        "reviewed": REVIEWED,
        "arms": list(ARMS),
        "registration": "experiments/2026-10-support-types.md",
        "words": words,
        "excluded": sorted(off_list),
    }
