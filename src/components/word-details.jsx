import { Volume2 } from "lucide-react"
import { AiBadge, IconButton } from "@/components/controls"

const locks = { mnemonic: "助记", etymology: "词源与构词", confusables: "易混词", mistakes: "常见错误" }

function DetailSection({ title, entries, render, fromAi }) {
  if (!entries?.length) return null
  return (
    <section className="detail-section">
      <h3>{title}{fromAi && <AiBadge />}</h3>
      <ul role="list">
        {entries.map((entry, index) => <li key={index}>{render(entry)}</li>)}
      </ul>
    </section>
  )
}

function Gloss({ english, translation, fromAi }) {
  return (
    <>
      {english && <strong lang="en">{english}</strong>}
      {translation && <span className="translation">{translation}{fromAi && <AiBadge />}</span>}
    </>
  )
}

function ExampleLine({ example }) {
  return example && (
    <span className="translation">
      <span lang="en">{example.en}</span>{example.en && example.zh && " · "}{example.zh}
    </span>
  )
}

export function WordDetails({ detail, sound, speak }) {
  const { view, categories, note, limited } = detail
  const sections = [
    {
      title: "释义",
      fromAi: view.meaningsSource === "ai",
      entries: view.meanings,
      render: ({ pos, senses }) => (
        <>
          {pos && <strong lang="en" className="part-of-speech">{pos}</strong>}
          {senses.map((sense, index) => (
            <div className="sense" key={index}>
              <span>{sense.zh}</span>
              {sense.en && <span lang="en" className="translation">{sense.en}</span>}
              <ExampleLine example={sense.ex} />
            </div>
          ))}
        </>
      ),
    },
    {
      title: "例句",
      fromAi: true,
      entries: view.examples,
      render: (example) => (
        <div className="example">
          <div><Gloss english={example.en} translation={example.zh} /></div>
          {sound && <IconButton label={`朗读例句 ${example.en}`} onClick={() => speak(example.en)}><Volume2 /></IconButton>}
        </div>
      ),
    },
    ...[["短语", view.phrases], ["搭配", view.collocations], ["句型", view.patterns]].map(([title, entries]) => ({
      title,
      fromAi: true,
      entries,
      render: (entry) => <><Gloss english={entry.en} translation={entry.zh} /><ExampleLine example={entry.ex} /></>,
    })),
    ...[["助记", view.mnemonic], ["用法", view.usage]].map(([title, text]) => ({
      title, fromAi: true, entries: text ? [text] : [], render: (entry) => entry,
    })),
  ]

  if (view.etymology) {
    const { origin, parts = [] } = view.etymology
    sections.push({
      title: "词源与构词",
      fromAi: true,
      entries: [...(origin ? [{ meaning: origin }] : []), ...parts],
      render: (entry) => <Gloss english={entry.part} translation={entry.meaning} />,
    })
  }
  for (const [title, entries, fromAi] of [
    ["近义词", view.synonyms, true], ["反义词", view.antonyms, true], ["易混词", view.confusables, true],
    ["词族", view.family, true], ["同根词", view.cognates, true], ["词形变化", view.inflections, false],
  ]) {
    sections.push({
      title, fromAi, entries,
      render: (entry) => <Gloss english={entry.w} translation={entry.m || entry.label || [entry.pos, entry.zh].filter(Boolean).join(" ")} />,
    })
  }
  for (const category of categories ?? []) {
    sections.push({
      title: `同类词 · ${category.name}`,
      entries: category.words,
      render: (entry) => <Gloss english={entry.display || entry.spelling} translation={entry.def} fromAi={entry.defFromAi === true} />,
    })
  }
  sections.push(
    {
      title: "常见错误", fromAi: true, entries: view.mistakes,
      render: (entry) => <Gloss english={`${entry.wrong} → ${entry.right}`} translation={entry.note} />,
    },
    { title: "我的笔记", entries: note ? [note] : [], render: (entry) => entry },
  )

  const available = sections.filter(({ entries }) => entries?.length)
  const locked = Object.keys(locks).filter((key) => limited?.locked?.[key]).map((key) => locks[key])
  return (
    <>
      {available.map((section) => <DetailSection key={section.title} {...section} />)}
      {locked.length > 0 && <p className="translation">今日详情额度已用完（{locked.join("、")}）</p>}
      {!available.length && !locked.length && <p className="translation">暂无更多资料</p>}
    </>
  )
}
