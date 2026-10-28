import { Link } from 'react-router-dom'

/** Shown when scores are general (no profile or scan yet): says what the number is and how to make it yours. */
export function PersonalizeNudge({ compact = false }: { compact?: boolean }) {
  return (
    <div className="p-5 flex flex-col gap-3" style={{ border: '1px solid var(--primary)' }}>
      <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--primary)' }}>Make this score yours</p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
        {compact
          ? 'These are general scores, based only on the ingredients. Scan your skin or set your profile to get a Fit Score for you.'
          : 'This is a general score, based only on the ingredients, so it is the same for everyone. A Fit Score also counts your skin type, what your scan found, and any sensitivities you list.'}
      </p>
      <ol className="text-xs leading-relaxed flex flex-col gap-1 list-decimal pl-4" style={{ color: 'var(--muted)' }}>
        <li>Take one front photo in Skin Analysis. It finds your concerns, such as breakouts or dryness.</li>
        <li>Tap "Apply to my profile" on the results so your scan is saved.</li>
        <li>Add any ingredients you react to in your profile.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Link to="/skin-analysis" className="btn-primary text-xs">Scan my skin</Link>
        <Link to="/profile" className="btn-outline text-xs">Set my profile</Link>
      </div>
    </div>
  )
}

/** Plain-language rubric so the number is not a black box. */
export function HowWeScore() {
  return (
    <details className="p-5" style={{ border: '1px solid var(--rim)' }}>
      <summary className="cursor-pointer text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--muted)' }}>How we score</summary>
      <div className="mt-3 flex flex-col gap-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
        <p>Every product starts at 70, then we read its ingredient list:</p>
        <ul className="list-disc pl-4 flex flex-col gap-1">
          <li>High-concern ingredients (such as parabens, SLS, formaldehyde releasers): −15 each, up to −45.</li>
          <li>Moderate-concern ingredients (such as fragrance, denatured alcohol, mineral oil): −8 each, up to −24.</li>
          <li>Substances banned in the EU: −20 each, up to −40.</li>
          <li>Beneficial ingredients (such as hyaluronic acid, glycerin): +4 each, up to +30.</li>
        </ul>
        <p>
          We do not know how much of each ingredient is in a product, so the score reads the list, not the dose.
          The flagged-ingredient lists are our own curated rubric. The banned and fragrance-allergen lists follow EU rules.
          The Fit Score then adjusts this for your skin. It is guidance, not medical advice.
        </p>
      </div>
    </details>
  )
}
