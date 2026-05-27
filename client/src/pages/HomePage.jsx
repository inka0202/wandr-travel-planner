import SearchBar from '@/components/search/SearchBar';

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="container py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-6xl text-navy-900 leading-tight mb-4">
            Plan your next escape.
          </h1>
          <p className="text-lg text-navy-600">
            See the weather, discover what&apos;s nearby, and save the trips you&apos;ll actually
            take.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <SearchBar variant="hero" />
        </div>
      </section>

      {/* Feature explainer */}
      <section className="container py-16">
        <div className="grid sm:grid-cols-3 gap-8 text-center">
          <Feature
            title="Live weather"
            body="Current conditions and a 7-day forecast for any destination."
          />
          <Feature
            title="Nearby attractions"
            body="Hand-picked sights mapped to where you'll actually be."
          />
          <Feature
            title="Save your trips"
            body="Build a collection. Come back to your plans anytime."
          />
        </div>
      </section>
    </>
  );
}

function Feature({ title, body }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-navy-900 mb-2">{title}</h3>
      <p className="text-navy-600">{body}</p>
    </div>
  );
}
