-- Spelling app: Postgres schema
--
-- Design rules, enforced here rather than in policy:
--   1. No child name, email, date of birth or school. A child is a pseudonymous row.
--   2. Attempts are immutable. Never UPDATE an attempt; the history is the dataset.
--   3. Experiment arm is stamped at assignment time, not inferred later.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- people

CREATE TABLE adults (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entra_object_id TEXT UNIQUE NOT NULL,          -- Entra ID, the only identity we hold
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliberately minimal. "nickname" is chosen by the adult and need not be a real name.
CREATE TABLE learners (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adult_id      UUID NOT NULL REFERENCES adults(id) ON DELETE CASCADE,
    nickname      TEXT NOT NULL,
    year_group    SMALLINT CHECK (year_group BETWEEN 1 AND 9),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ                       -- soft delete, hard purge job runs monthly
);

-- ---------------------------------------------------------------- content

CREATE TABLE patterns (
    key         TEXT PRIMARY KEY,                   -- 'doubling-1-1-1', matches engine/words.py
    explanation TEXT NOT NULL
);

CREATE TABLE words (
    word        TEXT PRIMARY KEY,
    list        TEXT NOT NULL,                      -- 'dfe-y5y6-statutory'
    syllables   TEXT NOT NULL,
    morphemes   TEXT NOT NULL,
    lang        TEXT NOT NULL,
    root        TEXT NOT NULL,
    gloss       TEXT NOT NULL,
    traps       TEXT[] NOT NULL,
    why         TEXT NOT NULL,
    family      TEXT[] NOT NULL
);

CREATE TABLE word_patterns (
    word        TEXT REFERENCES words(word) ON DELETE CASCADE,
    pattern_key TEXT REFERENCES patterns(key) ON DELETE CASCADE,
    ordinal     SMALLINT NOT NULL,                  -- 0 = primary pattern, used for interleaving
    PRIMARY KEY (word, pattern_key)
);

-- Generated offline by the Anthropic API, then reviewed by a human before use.
CREATE TABLE word_content (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word          TEXT NOT NULL REFERENCES words(word) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('sentence','rule_card','distractor','hook')),
    body          TEXT NOT NULL,
    audio_blob    TEXT,                             -- Blob Storage path, null for text-only
    reviewed_by   UUID REFERENCES adults(id),
    reviewed_at   TIMESTAMPTZ,
    active        BOOLEAN NOT NULL DEFAULT false    -- nothing unreviewed is ever shown
);
CREATE INDEX ON word_content (word, kind) WHERE active;

-- ---------------------------------------------------------------- practice

CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id  UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('practice','baseline_probe','delayed_test')),
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ
);

-- Immutable. One row per attempt, forever.
CREATE TABLE attempts (
    id                  BIGSERIAL PRIMARY KEY,
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id          UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    word                TEXT NOT NULL REFERENCES words(word),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    prompt_mode         TEXT NOT NULL CHECK (prompt_mode IN
                          ('audio_sentence','audio_word','text_cloze','dictation_paper')),
    -- Which voice said it. Pre-rendered clips (tools/render_audio.py) and the device's
    -- own speech are different stimuli, so they are recorded rather than pooled, for
    -- the same reason prompt_mode is. 'mixed': a clip failed and the device covered.
    audio_source        TEXT CHECK (audio_source IN ('clip','device','mixed')),
    attempt_text        TEXT NOT NULL,
    correct             BOOLEAN NOT NULL,

    error_type          TEXT,                       -- from engine/classify.py
    error_detail        TEXT,
    error_patterns      TEXT[],
    sounds_right        BOOLEAN,                    -- phonologically plausible
    trap                TEXT,

    method_shown        TEXT,                       -- which ladder rung, null if none
    arm                 CHAR(1) CHECK (arm IN ('A','B')),
    experiment_id       UUID,

    box_before          SMALLINT,
    box_after           SMALLINT,
    days_since_last     INTEGER,
    position_in_session SMALLINT,
    latency_ms          INTEGER,
    edits_before_submit SMALLINT
);
CREATE INDEX ON attempts (learner_id, created_at);
CREATE INDEX ON attempts (learner_id, word);
CREATE INDEX ON attempts (experiment_id) WHERE experiment_id IS NOT NULL;

-- Current scheduler state. This one IS mutable; attempts hold the history.
CREATE TABLE scheduler_state (
    learner_id  UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    word        TEXT NOT NULL REFERENCES words(word),
    box         SMALLINT NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
    due_on      DATE NOT NULL,
    seen        INTEGER NOT NULL DEFAULT 0,
    wrong       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (learner_id, word)
);
CREATE INDEX ON scheduler_state (learner_id, due_on);

CREATE TABLE pattern_state (
    learner_id  UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    pattern_key TEXT NOT NULL REFERENCES patterns(key),
    seen        INTEGER NOT NULL DEFAULT 0,
    wrong       INTEGER NOT NULL DEFAULT 0,
    rung        SMALLINT NOT NULL DEFAULT 1,        -- position on the escalation ladder
    PRIMARY KEY (learner_id, pattern_key)
);

-- ---------------------------------------------------------------- measurement

CREATE TABLE profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id              UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_session_id       UUID REFERENCES sessions(id),
    phonological_reliance   NUMERIC(4,3),
    orthographic_choice     NUMERIC(4,3),
    error_mix               JSONB NOT NULL,
    pattern_strength        JSONB NOT NULL,
    confidence              TEXT NOT NULL CHECK (confidence IN ('low','medium','high'))
);

CREATE TABLE strategy_probes (
    id          BIGSERIAL PRIMARY KEY,
    attempt_id  BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    response    TEXT NOT NULL CHECK (response IN
                  ('sounded_out','looked_right','thought_about_parts','just_knew')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-registered before any data is collected. See docs/04-experiment.md.
CREATE TABLE experiments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    question        TEXT NOT NULL,
    method_a        TEXT NOT NULL,
    method_b        TEXT NOT NULL,
    error_type      TEXT NOT NULL,
    outcome_measure TEXT NOT NULL,
    stop_rule       TEXT NOT NULL,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ
);

-- Assignment is made once, randomly, and stamped. Never re-derived.
CREATE TABLE experiment_assignments (
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    learner_id    UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    word          TEXT NOT NULL REFERENCES words(word),
    arm           CHAR(1) NOT NULL CHECK (arm IN ('A','B')),
    pair_id       UUID NOT NULL,                    -- the matched pair this word belongs to
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (experiment_id, learner_id, word)
);

-- ---------------------------------------------------------------- retention

-- Run monthly. Hard-deletes soft-deleted learners and everything cascading from them.
-- Retention period is set in docs/06-data-protection.md, not here, so it is reviewable.
