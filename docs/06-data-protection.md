# Data protection: read this before the second child uses it

This is the section that can stop the project, so it goes early rather than late.

## The line

**Your own child, on your own device, data staying in your control:** most of the below does
not bite. Build freely.

**A second family's child:** the ICO Children's code applies in full, and a **DPIA becomes
legally mandatory before launch**. Not advisable. Mandatory.

**A school:** add a written data processing agreement, supplier due diligence, and the
school's own DPIA, which they will expect you to help complete.

## Why the DPIA is mandatory, not optional

The Children's code is a statutory code applying to information society services likely to be
accessed by under-18s, "even if it's not aimed at them". Schools are out of scope; **an
edtech service used by a school is still in scope**, so the developer is caught even where
the school is not.
[Introduction to the code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code/)

The code states plainly: "if you offer an online service likely to be accessed by children,
you must do a DPIA".
[DPIA standard](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/2-data-protection-impact-assessments/)

Two independent ICO high-risk triggers also apply: personal data of children used for
profiling or automated decision-making, and innovative technologies including AI.
[When a DPIA is needed](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/)

Adaptive difficulty is arguably profiling. That is not a reason to avoid building it. It is a
reason to document it, justify it against the child's interests, and default it sensibly.

## The standards that actually change the build

| Standard | What it forces here |
|---|---|
| 1. Best interests of the child | The child's learning and wellbeing is the primary design consideration, ahead of retention metrics |
| 3. Age appropriate application | Simplest route: apply the standards to every user rather than trying to verify age |
| 7. Default settings | High privacy by default |
| 8. Data minimisation | No name, no email, no DOB, no school in the learner record. The schema already does this |
| 12. Profiling | Off by default, justified when on |
| 13. Nudge techniques | **This is why there is no streak.** No persuasive design pushing children to keep playing or share more |
| 5. Detrimental use | No use of children's data in ways that could harm wellbeing |

[The 15 standards](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/)

Note the convergence: the streak is both the weakest-evidenced feature and the most exposed
one. Dropping it is free.

## If a school uses it

DfE is explicit that for most pupil data **the school or trust is the controller** and the
supplier is a processor acting on its instructions. A supplier that processes pupil data for
its own purposes, including product improvement, becomes an independent controller. Avoid
that status.
[DfE responsibilities](https://www.gov.uk/guidance/data-protection-in-schools/responsibilities)

The DPA will need: security measures, sub-processors and oversight, deletion or return on
termination, breach notification timelines, and access controls. Schools are told to ask for
storage locations, transfer safeguards, certifications, penetration testing, portability, and
**deletion from backups and caches**.
[DfE edtech procurement guidance](https://www.gov.uk/guidance/data-protection-in-schools/procuring-educational-technology-edtech)

Practical consequence for the build: a working data export and a working hard-delete are
launch features for school use, not nice-to-haves.

## The AI boundary

DfE discourages entering pupils' personal data into generative AI tools, and where a school
does, requires assurance that the data is not used to train the model.
[DfE generative AI and data protection](https://www.gov.uk/guidance/data-protection-in-schools/generative-artificial-intelligence-ai-and-data-protection-in-schools)

DfE's product safety standards for developers require no use of personal data or
learner-created content for commercial purposes **including model training or fine-tuning**,
age-appropriate privacy notices stating processing locations, reliable content filtering, and
activity logging with safeguarding alerts.
[Generative AI product safety standards](https://www.gov.uk/government/publications/generative-ai-product-safety-standards/generative-ai-product-safety-standards)

**The architecture already avoids most of this.** Content is generated offline from the word
list, not from child data. A word attempt plus a target word, with no identifier and no free
text, is very likely not personal data at the API boundary at all.

The risk concentrates in one place: **free-written sentences**. If the app ever asks a child
to write a sentence using the word, and sends that to an API, it is sending a child's writing
about their own life to a third party. Children volunteer a great deal unprompted. If that
feature is wanted, mark, store and analyse it locally.

## Actions, in order

1. Decide the scope question before writing the front end. It changes what you build.
2. If scope is wider than your own child: write the DPIA before launch, and let it change the
   design rather than describe it afterwards.
3. Ship export and hard-delete alongside the first multi-user release.
4. Re-check the Children's code before any launch. Post Data (Use and Access) Act revisions
   to ICO codes were anticipated and could not be confirmed as of September 2026.
