import { Segmented } from 'antd';
import { statusOptions } from '../constants/volunteer';
import { VolunteerStatus } from '../types/volunteer';

interface StatusFilterProps {
  value: VolunteerStatus | 'ALL';
  onChange: (value: VolunteerStatus | 'ALL') => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Segmented
      value={value}
      options={[{ value: 'ALL', label: '全部' }, ...statusOptions]}
      onChange={(nextValue) => onChange(nextValue as VolunteerStatus | 'ALL')}
    />
  );
}
