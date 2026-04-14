import React, { useMemo } from 'react';
import { CalendarEvent } from '../../types/calendar';

interface EventChipProps {
  event: CalendarEvent;
  onClick?: (e: React.MouseEvent) => void;
}

export const EventChip: React.FC<EventChipProps> = ({ event, onClick }) => {
  
  const style = useMemo(() => {
    if (event.type === 'economic') {
      // Fed 금리 결정 등 경제 이벤트는 붉은색 강조
      return {
        backgroundColor: 'rgba(255, 82, 82, 0.25)',
        borderLeftColor: '#ff5252',
        color: '#ffcccc'
      };
    }

    // 기업 실적 등은 랜덤 파스텔 톤 (symbol 기반으로 고정된 랜덤색)
    const stringToColor = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = Math.abs(hash) % 360;
      return `hsl(${h}, 60%, 25%)`; // Darker background
    };

    const stringToBorderColor = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const h = Math.abs(hash) % 360;
      return `hsl(${h}, 70%, 60%)`; // Brighter border
    };

    const seed = event.companySymbol || event.title;
    
    return {
      backgroundColor: stringToColor(seed),
      borderLeftColor: stringToBorderColor(seed),
      color: '#eee'
    };
  }, [event]);

  return (
    <div 
      className={`event-chip`} 
      title={`${event.title} - ${event.time}`}
      style={style}
      onClick={onClick}
    >
      {event.time && <span style={{ opacity: 0.7, marginRight: '4px', fontSize: '10px' }}>{event.time.split(' ')[0]}</span>}
      {event.title}
    </div>
  );
};
