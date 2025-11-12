import { FeatureCard } from '../ui/FeatureCard';
import { TypingCursor } from '../ui/TypingCursor';

export function FeaturesSection() {
  const features = [
    {
      moduleNumber: 'MODULE_01',
      icon: '🌱',
      title: 'Cultivate\nKnowledge',
      description: 'Build your learning garden with intelligent spaced repetition algorithms that adapt to your natural cognitive rhythm.',
      features: [
        'SM-2 algorithm',
        'Adaptive scheduling',
        'Pattern recognition',
      ],
    },
    {
      moduleNumber: 'MODULE_02',
      icon: '🎯',
      title: 'ADHD\nOptimized',
      description: 'Ruthlessly minimal interfaces. Zero cognitive overhead. Engineered for sustained attention and deep focus.',
      features: [
        'Reduced visual noise',
        'Clear information hierarchy',
        'Distraction elimination',
      ],
    },
    {
      moduleNumber: 'MODULE_03',
      icon: '🤝',
      title: 'Shared\nCommons',
      description: 'Access the collective knowledge base. Contribute your insights. Education as public infrastructure.',
      features: [
        '15K+ public decks',
        'Community curated',
        'Open contribution',
      ],
    },
  ];

  return (
    <div className="bg-terminal-base py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 font-mono terminal-primary text-sm flex items-center">
          $ ./list-features --verbose
          <TypingCursor />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <FeatureCard key={feature.moduleNumber} {...feature} />
          ))}
        </div>
      </div>
    </div>
  );
}
