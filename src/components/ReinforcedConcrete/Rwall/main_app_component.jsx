import React, { useState } from 'react';
import { BookOpen, Globe, Ruler } from 'lucide-react';
import Retaining from './rc_retaining_app';
import EurocodeDesigner from './eurocode_component';
import DesignCodeToggle from '../../shared/primitives/DesignCodeToggle';
import { WorkspacePage, PageHeader, MetaChip } from '../../shared/ui';

/**
 * MainRetainingApp — retaining wall design entry point.
 *
 * UI cleanup: the bespoke navigation bar (logo + two oversized standard buttons)
 * is replaced by the shared `PageHeader` + `DesignCodeToggle`. `activeStandard`
 * values ('bs' | 'eurocode') and both designer components are unchanged.
 */
const MainRetainingApp = ({ isDark = false }) => {
  const [activeStandard, setActiveStandard] = useState('eurocode');

  return (
    <WorkspacePage width="wide">
      <PageHeader
        title="Retaining Wall Designer"
        subtitle="Cantilever and gravity retaining walls — earth pressure, stability and structural design."
        icon={<Ruler size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone={activeStandard === 'bs' ? 'info' : 'success'}>
              {activeStandard === 'bs' ? 'BS standards' : 'Eurocodes'}
            </MetaChip>
            <MetaChip>
              {activeStandard === 'bs'
                ? 'BS 8110 · BS 8007 · BS 4449'
                : 'EN 1992-1-1 · EN 1992-3 · EN 1997-1 · EN 1990'}
            </MetaChip>
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
                label: 'BS Codes',
                icon: <Globe size={14} aria-hidden="true" />,
              },
              {
                id: 'eurocode',
                label: 'Eurocodes',
                icon: <BookOpen size={14} aria-hidden="true" />,
              },
            ]}
          />
        }
      />

      <div className="transition-all duration-500">
        {activeStandard === 'bs' ? (
          <Retaining isDark={isDark} />
        ) : (
          <EurocodeDesigner isDark={isDark} />
        )}
      </div>
    </WorkspacePage>
  );
};

export default MainRetainingApp;
