import Image from "next/image";

export function HeroMobileBg() {
  return (
    <div className="absolute inset-0 lg:hidden">
      <Image
        src="/images/hero-person-mobile.png"
        alt=""
        fill
        priority
        className="object-cover object-right"
        sizes="100vw"
      />
      {/* Dark overlay so text is always readable over the photo */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Directional fade — lighter on right so image shows through */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 from-10% via-black/10 to-transparent" />
    </div>
  );
}
