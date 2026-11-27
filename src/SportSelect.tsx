import {individualSports,type IndividualSport} from './shared/individual-sports';

export function SportSelect({sport,onSelect}:{sport:IndividualSport;onSelect:(sport:IndividualSport)=>void}) {
  return <label>Seleziona sport
    <select aria-label="Seleziona sport" value={sport} onChange={event=>onSelect(event.target.value as IndividualSport)}>
      {Object.entries(individualSports).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}
