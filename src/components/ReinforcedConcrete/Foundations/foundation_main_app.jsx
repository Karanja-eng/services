import React, { useState } from 'react';
import { Book, FileText, Ruler } from 'lucide-react';
import BSFoundationApp from './BsCodes';
import EurocodeFoundationApp from './eurocode_foundation_app';
import DesignCodeToggle from '../../shared/primitives/DesignCodeToggle';
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  TechnicalDetails,
} from '../../shared/ui';

/**
 * FoundationMainApp — RC foundation design entry point.
 *
 * UI cleanup: page chrome and the standard selector now come from the shared UI
 * kit, so the header/padding/breakpoints match every other structural workflow.
 * `activeStandard` values ('bs' | 'eurocode') and the two calculator components
 * are unchanged — no payload, formula or default was touched.
 */
const FoundationMainApp = ({ isDark = false }) => {
  const [activeStandard, setActiveStandard] = useState('bs');

  const standards =
    activeStandard === 'bs'
      ? [
          'BS EN 1992-1-1:2004',
          'BS 8004:2015',
          'BS EN 1997-1:2004',
        ]
      : ['EN 1990:2002', 'EN 1992-1-1:2004', 'EN 1997-1:2004', 'EN 1991 series'];

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="Foundation Design"
        subtitle={
          activeStandard === 'bs'
            ? 'Pad, strip, combined and pile-cap footings to BS standards.'
            : 'Geotechnical and structural foundation design to the Eurocodes.'
        }
        icon={<Ruler size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone={activeStandard === 'bs' ? 'info' : 'success'}>
              {activeStandard === 'bs' ? 'BS standards' : 'Eurocodes'}
            </MetaChip>
            {standards.map((code) => (
              <MetaChip key={code}>{code}</MetaChip>
            ))}
          </>
        }
        actions={
          <DesignCodeToggle
            value={activeStandard}
            onChange={setActiveStandard}
            isDark={isDark}
            ariaLabel="Design standard"
            options={[
              {
                id: 'bs',
                label: 'BS Standards',
                icon: <Book size={14} aria-hidden="true" />,
              },
              {
                id: 'eurocode',
                label: 'Eurocodes',
                icon: <FileText size={14} aria-hidden="true" />,
              },
            ]}
          />
        }
      />

      <div className="space-y-4 sm:space-y-6">
        <Section
          title={
            activeStandard === 'bs'
              ? 'British Standards design system'
              : 'Eurocode design system'
          }
          description={
            activeStandard === 'bs'
              ? 'Design foundations according to BS EN 1992-1-1:2004, BS 8004:2015 and BS EN 1997-1:2004.'
              : 'Design foundations according to EN 1990:2002, EN 1991, EN 1992-1-1:2004 and EN 1997-1:2004.'
          }
          icon={
            activeStandard === 'bs' ? (
              <Book size={18} aria-hidden="true" />
            ) : (
              <FileText size={18} aria-hidden="true" />
            )
          }
        >
          <div className="pt-1">
            {activeStandard === 'bs' ? (
              <BSFoundationApp isDark={isDark} />
            ) : (
              <EurocodeFoundationApp isDark={isDark} />
            )}
          </div>
        </Section>

        {/* Reference comparison, collapsed by default so it does not push the
            design inputs below the fold on phones. */}
        <TechnicalDetails summary="Which standard should I use?">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-bold text-gray-800 dark:text-slate-100">
                BS Standards features
              </p>
              <ul className="list-inside list-disc space-y-1 text-gray-600 dark:text-slate-300">
                <li>UK-specific design methodology</li>
                <li>BS 8004:2015 foundation code compliance</li>
                <li>UK National Annex parameters</li>
                <li>Load factors: 1.35Gk + 1.5Qk</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 font-bold text-gray-800 dark:text-slate-100">
                Eurocode features
              </p>
              <ul className="list-inside list-disc space-y-1 text-gray-600 dark:text-slate-300">
                <li>Pan-European standardised approach</li>
                <li>Design approaches 1, 2 and 3 (EN 1997-1)</li>
                <li>Comprehensive action combinations</li>
                <li>National Annex selection support</li>
              </ul>
            </div>
          </div>
        </TechnicalDetails>
      </div>
    </WorkspacePage>
  );
};

export default FoundationMainApp;
