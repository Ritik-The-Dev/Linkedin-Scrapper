import type { Lead } from '../../types/lead.ts';
import { entityKey, fieldDate, fieldString, fieldUrl } from '../../utils/entity.ts';
import { asArray, formatDateRange, formatLinkedInDate } from '../../utils/formatters.ts';
import { SectionCard } from '../common/Card.tsx';
import { AwardIcon } from '../common/icons.tsx';
import { EntityList } from './EntityList.tsx';
import type { EntityItemData } from './EntityList.tsx';

export function CertificationsSection({ lead }: { lead: Lead }) {
  const certifications = asArray(lead.certifications);
  if (certifications.length === 0) return null;

  const items: EntityItemData[] = certifications.map((certification, index) => {
    const name = fieldString(certification, ['name', 'title', 'certificationName']);
    const issued = fieldDate(certification, ['startDate', 'issueDate', 'issuedOn', 'date']);
    const expires = fieldDate(certification, ['endDate', 'expirationDate', 'expiresOn']);
    const licence = fieldString(certification, ['licenseNumber', 'licenseNo', 'credentialId']);

    const range = expires !== null ? formatDateRange(issued, expires) : formatLinkedInDate(issued);
    const meta = [
      range !== null ? (expires !== null ? range : `Issued ${range}`) : null,
      licence !== null ? `ID ${licence}` : null,
    ].filter((part): part is string => part !== null);

    return {
      key: entityKey(certification, name, index),
      title: name,
      subtitle: fieldString(certification, ['authority', 'issuer', 'organization', 'companyName']),
      meta: meta.length > 0 ? meta.join('  ·  ') : null,
      description: fieldString(certification, ['description']),
      url: fieldUrl(certification, ['url', 'credentialUrl', 'certificateUrl']),
    };
  });

  return (
    <SectionCard
      id="certifications"
      title="Licenses & certifications"
      count={items.length}
      icon={<AwardIcon className="size-4" />}
    >
      <EntityList items={items} />
    </SectionCard>
  );
}
