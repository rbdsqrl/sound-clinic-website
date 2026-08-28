/** A date/time range picked by dragging across hour cells on the calendar. */
export interface SlotSelection {
  date: string   // 'yyyy-MM-dd'
  start: string  // 'HH:mm'
  end: string    // 'HH:mm'
}
