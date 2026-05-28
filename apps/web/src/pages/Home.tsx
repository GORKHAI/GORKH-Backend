import Hero from '@/sections/Hero';
import KineticWordmark from '@/sections/KineticWordmark';
import MemoryArchitecture from '@/sections/MemoryArchitecture';
import StrategicTiming from '@/sections/StrategicTiming';
import SocialProof from '@/sections/SocialProof';
import CTASection from '@/sections/CTASection';

export default function Home() {
  return (
    <main>
      <Hero />
      <KineticWordmark />
      <MemoryArchitecture />
      <StrategicTiming />
      <SocialProof />
      <CTASection />
    </main>
  );
}
