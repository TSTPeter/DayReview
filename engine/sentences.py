"""
Context sentences, one per word, for the dictation prompt.

WHY THESE EXIST. docs/07 reproduces the KS2 administration script exactly:

    The word is passed. They passed a bridge on their way to school. The word is passed.

Word, sentence, word again, then a pause of at least twelve seconds. Building the
prompt in that shape costs nothing, is what she will meet in May, and happens to match
the evidence for dictation in context anyway. Without a sentence per word the app
cannot honour that non-negotiable at all.

REVIEW STATUS. docs/05 decision 2 keeps generated content out of the request path and
behind a human review gate: nothing unreviewed is shown to a child. These were written
offline and are collected here, in one file, precisely so they can be read in one
sitting. READ THEM BEFORE SHE DOES. Two things to check:

  1. The sentence must not give the spelling away, and must not lean on a homophone.
     'stationary' and 'stationery' are the obvious trap; so is 'practice'/'practise'.
  2. The sentence must disambiguate the word, because that is the job the KS2 script
     gives it. 'The word is queue' is ambiguous; the sentence has to fix which one.

The KS2 administrator is told not to overemphasise the target word, so these are
deliberately flat and ordinary rather than memorable.
"""

SENTENCES = {
    "accommodate": "The hotel could accommodate forty guests.",
    "accompany": "Her father would accompany her to the concert.",
    "according": "According to the map, the river was a mile away.",
    "achieve": "She worked hard to achieve her best result.",
    "aggressive": "The dog's aggressive barking frightened the postman.",
    "amateur": "He was still an amateur, but he played like a professional.",
    "ancient": "They found an ancient coin buried in the field.",
    "apparent": "It soon became apparent that we were lost.",
    "appreciate": "I really appreciate everything you have done.",
    "attached": "She attached the photograph to her letter.",
    "available": "There were no seats available on the train.",
    "average": "His average score was better than last term.",
    "awkward": "There was an awkward silence after the question.",
    "bargain": "The coat was a real bargain in the sale.",
    "bruise": "She had a purple bruise on her knee.",
    "category": "Cheese belongs in the dairy category.",
    "cemetery": "The old cemetery stood beside the church.",
    "committee": "The committee met to decide on the new rules.",
    "communicate": "Whales communicate across huge distances.",
    "community": "The whole community turned out for the fair.",
    "competition": "He won first prize in the writing competition.",
    "conscience": "Her conscience troubled her all evening.",
    "conscious": "The patient was conscious and talking.",
    "controversy": "The decision caused a great deal of controversy.",
    "convenience": "The shop stayed open late for our convenience.",
    "correspond": "The two friends still correspond by letter.",
    "criticise": "It is easy to criticise, and harder to help.",
    "curiosity": "Her curiosity got the better of her.",
    "definite": "We need a definite answer by Friday.",
    "desperate": "He made a desperate attempt to catch the bus.",
    "determined": "She was determined to finish the race.",
    "develop": "Plants develop quickly in warm weather.",
    "dictionary": "Look the word up in a dictionary.",
    "disastrous": "The picnic was disastrous because of the rain.",
    "embarrass": "He did not want to embarrass his sister.",
    "environment": "We must look after the environment.",
    "equip": "The school will equip every classroom with a screen.",
    "equipped": "The expedition was well equipped for the cold.",
    "equipment": "All the camping equipment fitted into one bag.",
    "especially": "She loves fruit, especially raspberries.",
    "exaggerate": "Do not exaggerate, it was only a small fish.",
    "excellent": "Her handwriting is excellent this term.",
    "existence": "Nobody knew of the tunnel's existence.",
    "explanation": "His explanation made perfect sense.",
    "familiar": "The song sounded familiar.",
    "foreign": "He was learning a foreign language.",
    "forty": "There were forty children in the hall.",
    "frequently": "Buses run frequently along this road.",
    "government": "The government announced a new law.",
    "guarantee": "The watch came with a two-year guarantee.",
    "harass": "Do not harass the animals at the zoo.",
    "hindrance": "The heavy bag was more hindrance than help.",
    "identity": "She kept her identity a secret.",
    "immediate": "The medicine had an immediate effect.",
    "immediately": "He left immediately after breakfast.",
    "individual": "Each individual had a different answer.",
    "interfere": "Please do not interfere with the experiment.",
    "interrupt": "It is rude to interrupt someone who is speaking.",
    "language": "Welsh is a beautiful language.",
    "leisure": "She reads for pleasure in her leisure time.",
    "lightning": "Lightning lit up the whole sky.",
    "marvellous": "We had a marvellous time at the seaside.",
    "mischievous": "The mischievous kitten knocked over the plant.",
    "muscle": "He pulled a muscle playing football.",
    "necessary": "Warm boots are necessary in the snow.",
    "neighbour": "Our neighbour looks after our cat.",
    "nuisance": "The wasps were a real nuisance at lunch.",
    "occupy": "The books occupy three whole shelves.",
    "occur": "Storms often occur in autumn.",
    "opportunity": "This is a wonderful opportunity.",
    "parliament": "The new law was debated in parliament.",
    "persuade": "She tried to persuade him to come.",
    "physical": "Swimming is good physical exercise.",
    "prejudice": "We must all stand against prejudice.",
    "privilege": "It is a privilege to be asked.",
    "profession": "Teaching is a rewarding profession.",
    "programme": "The television programme lasted an hour.",
    "pronunciation": "Her pronunciation of French is excellent.",
    "queue": "We joined the queue outside the cinema.",
    "recognise": "I did not recognise him with his new haircut.",
    "recommend": "I would recommend this book to anyone.",
    "relevant": "Please keep your answer relevant.",
    "restaurant": "We ate at a small Italian restaurant.",
    "rhyme": "Orange is a hard word to rhyme.",
    "rhythm": "The drummer kept a steady rhythm.",
    "sacrifice": "Winning the cup took real sacrifice.",
    "secretary": "The secretary took notes at the meeting.",
    "shoulder": "He carried the bag on one shoulder.",
    "signature": "Please add your signature at the bottom.",
    "sincere": "Please accept my sincere apology.",
    "sincerely": "She thanked them sincerely for their help.",
    "soldier": "The soldier stood perfectly still.",
    "stomach": "Too much cake gave him a sore stomach.",
    "sufficient": "One blanket was not sufficient.",
    "suggest": "May I suggest a different route?",
    "symbol": "The dove is a symbol of peace.",
    "system": "The heating system broke down.",
    "temperature": "The temperature dropped below freezing.",
    "thorough": "She gave the room a thorough clean.",
    "twelfth": "This is her twelfth birthday.",
    "variety": "The shop sells a variety of sweets.",
    "vegetable": "A carrot is my favourite vegetable.",
    "vehicle": "No vehicle may park here.",
    "yacht": "A white yacht sailed into the harbour.",
    # off-list transfer words
    "possession": "The ring was her most treasured possession.",
    "separate": "Please keep the two piles separate.",
    "irregular": "The stitches were irregular and uneven.",
    "delicious": "The soup was absolutely delicious.",
    "knowledge": "Her knowledge of birds is remarkable.",
    "useful": "A torch is useful when you go camping.",
    "beautiful": "The garden looked beautiful in the spring.",
    "chemistry": "We mixed the two liquids in chemistry.",
    # -ce/-se noun-verb pairs. These carry more weight than the rest: for four
    # of the five pairs the two words are HOMOPHONES, so the sentence is the
    # only thing in the dictation that can say which one is wanted. Each one
    # below is built so the grammar rules the other member out - a determiner
    # or an adjective in front of the noun, an auxiliary in front of the verb -
    # rather than merely making it unlikely. See derive.NOUN_VERB_PAIRS.
    "advice": "She gave me some good advice about the test.",
    "advise": "I would advise you to take a coat.",
    "device": "He plugged the small device into the wall.",
    "devise": "They had to devise a plan very quickly.",
    "licence": "My uncle keeps his licence in his wallet.",
    "license": "The council will license the new market.",
    "practice": "She was late for netball practice again.",
    "practise": "You should practise the piano every day.",
    "prophecy": "The old prophecy came true at last.",
    "prophesy": "Nobody can prophesy what will happen next.",
}

# British text-to-speech mispronounces some of these reliably enough to teach the wrong
# model of the word, which is worse than no audio. docs/05 decision 3 says check all of
# them by hand. These are the ones to listen to FIRST, and the respell is a fallback the
# app can speak instead if the voice gets it wrong. Verify on the actual device.
PRONUNCIATION_WATCHLIST = {
    "controversy": "con-TROV-er-see",
    "privilege": "PRIV-uh-lij",
    "programme": "PROH-gram",
    "cemetery": "SEM-uh-tree",
    "temperature": "TEM-pruh-cher",
    "vegetable": "VEJ-tuh-bul",
    "secretary": "SEK-ruh-tree",
    "yacht": "yot",
    "queue": "kyoo",
    "muscle": "MUSS-ul",
    "rhythm": "RITH-um",
    "conscience": "KON-shunss",
    "soldier": "SOHL-jer",
    "twelfth": "twelfth",
    "thorough": "THUH-ruh",
    "restaurant": "REST-ron",
    # Unlike the other four pairs these two are NOT homophones in British
    # English - the endings are -see and -sigh - so the voice getting them
    # right is the difference between a fair item and an unfair one. Listen
    # to this pair before any of the others.
    "prophecy": "PROF-uh-see",
    "prophesy": "PROF-uh-sigh",
}


def naming_line(word, hint=None):
    """
    The first and third lines of the KS2 script: 'The word is passed.'

    With a word-class hint for a -ce/-se pair: 'The word is advice, the noun.'
    web/js/audio.js builds exactly the same string, and tests/test_audio.py
    holds the two to it for every word, because a pre-rendered clip is found
    by its EXACT text. One stray comma and the clip is never played.
    """
    return f"The word is {word}, the {hint}." if hint else f"The word is {word}."


def for_word(word):
    return SENTENCES.get(word)


def missing(words):
    return [w for w in words if w not in SENTENCES]
