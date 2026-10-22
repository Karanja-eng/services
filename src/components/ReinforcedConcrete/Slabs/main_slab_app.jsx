import React, { useState } from 'react';
import { BookOpen, Euro, Ruler } from 'lucide-react';

import SlabCalculator from './slab_calculator_frontend';
import EurocodeSlabCalculator from './eurocode_slab_calculator';
import DesignCodeToggle from '../../shared/primitives/DesignCodeToggle';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  TechnicalDetails,
} from '../../shared/ui';

/**
 * MainSlabApp — RC slab design entry point.
 *
 * UI cleanup:
 * - The page previously rendered its own duplicate top navigation bar (logo,
 *   code toggle, settings) inside the application shell. That chrome is now the
 *   shared `PageHeader`, so the slab tool has the same header, padding and
 *   breakpoints as every other structural workflow.
 * - The "Settings" panel contained three selects (units / report format /
 *   precision) that were not wired to anything. Inventing behaviour for them
 *   would be worse than removing them, so they are gone; unit labels on the
 *   calculator inputs remain the single source of truth for units.
 * - `activeCode` values ('bs8110' | 'eurocode') and both calculator components
 *   are unchanged.
 */
const MainSlabApp = ({ isDark = false }) => {
  const [activeCode, setActiveCode] = useState('bs8110'); // 'bs8110' or 'eurocode'

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="Slab Design Suite"
        subtitle={
          activeCode === 'bs8110'
            ? 'British Standard 8110 — structural use of concrete.'
            : 'Eurocode 2 — design of concrete structures (EN 1992-1-1).'
        }
        icon={<Ruler size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone={activeCode === 'bs8110' ? 'info' : 'success'}>
              {activeCode === 'bs8110' ? 'BS 8110-1:1997' : 'EN 1992-1-1:2004'}
            </MetaChip>
            <MetaChip>One-way · Two-way · Ribbed · Waffle</MetaChip>
          </>
        }
        actions={
          <DesignCodeToggle
            value={activeCode}
            onChange={setActiveCode}
            isDark={isDark}
            ariaLabel="Design standard"
            options={[
              {
                id: 'bs8110',
                label: 'BS 8110',
                icon: <BookOpen size={14} aria-hidden="true" />,
              },
              {
                id: 'eurocode',
                label: 'Eurocode',
                icon: <Euro size={14} aria-hidden="true" />,
              },
            ]}
          />
        }
      />

      <div className="space-y-4 sm:space-y-6">
        <Section
          title={
            activeCode === 'bs8110'
              ? 'British Standard 8110 — structural use of concrete'
              : 'Eurocode 2 — design of concrete structures'
          }
          description={
            activeCode === 'bs8110'
              ? 'Complete slab design to BS 8110-1:1997, including one-way, two-way, ribbed and waffle slabs with the standard coefficient tables and design checks.'
              : 'Complete slab design to EN 1992-1-1:2004, including moment and shear calculations with Eurocode load combinations and material properties.'
          }
          icon={
            activeCode === 'bs8110' ? (
              <BookOpen size={18} aria-hidden="true" />
            ) : (
              <Euro size={18} aria-hidden="true" />
            )
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {['One-way slabs', 'Two-way slabs', 'Ribbed slabs', 'Waffle slabs', 'Multiple spans'].map(
              (feature) => (
                <MetaChip key={feature} tone={activeCode === 'bs8110' ? 'info' : 'success'}>
                  {feature}
                </MetaChip>
              )
            )}
          </div>

          <div className="transition-all duration-300">
            {activeCode === 'bs8110' ? (
              <SlabCalculator isDark={isDark} />
            ) : (
              <EurocodeSlabCalculator isDark={isDark} />
            )}
          </div>
        </Section>

        <TechnicalDetails summary="Supported slab configurations">
          <ul className="list-inside list-disc space-y-1 text-gray-600 dark:text-slate-300">
            <li>One-way simply supported, continuous and cantilever slabs.</li>
            <li>Two-way slabs with edge-continuity conditions.</li>
            <li>Ribbed and waffle slabs with topping and rib geometry.</li>
            <li>Reinforcement schedules for short-span and long-span steel.</li>
          </ul>
        </TechnicalDetails>
      </div>
    </WorkspacePage>
  );
};

export default MainSlabApp;
