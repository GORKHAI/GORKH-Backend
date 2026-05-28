import { Seo } from '@/components/Seo';
import { GORKH_WEBSITE_JSON_LD } from '@/seo';
import Hero from '@/sections/Hero';
import KineticWordmark from '@/sections/KineticWordmark';
import MemoryArchitecture from '@/sections/MemoryArchitecture';
import StrategicTiming from '@/sections/StrategicTiming';
import SocialProof from '@/sections/SocialProof';
import CTASection from '@/sections/CTASection';

export default function Home() {
  return (
    <main>
      <Seo
        title="GORKH | Real-Time AI Situational Copilot"
        description="GORKH is a consent-first AI situational copilot for live voice cues, daily briefs, source-backed research, and approval-gated actions."
        path="/"
        structuredData={GORKH_WEBSITE_JSON_LD}
      />
      <Hero />
      <KineticWordmark />
      <MemoryArchitecture />
      <StrategicTiming />
      <SocialProof />
      <CTASection />
    </main>
  );
}
