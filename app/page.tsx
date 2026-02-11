import { LandingFeatures } from "@/components/sections/landing-features";
import { LandingHero } from "@/components/sections/landing-hero";
import { LandingHow } from "@/components/sections/landing-how";
import { LandingPrivacy } from "@/components/sections/landing-privacy";

export default function HomePage() {
  return (
    <>
      <LandingHero />
      <LandingHow />
      <LandingFeatures />
      <LandingPrivacy />
    </>
  );
}
