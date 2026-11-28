'use client'

import React from 'react'
import { MapPin, Siren, Radio } from 'lucide-react'

const capabilities = [
  {
    icon: MapPin,
    title: 'Centre check-in',
    text: 'A GPS check confirms an officer is inside the centre perimeter before duty is recorded.',
  },
  {
    icon: Siren,
    title: 'Distress alerts',
    text: 'One hold sends the officer’s location and battery to the regional hub.',
  },
  {
    icon: Radio,
    title: 'Regional dispatch',
    text: 'Controllers see the current picture across every accredited centre.',
  },
]

export function NationalOperationsShowcase() {
  return (
    <aside className="ops-showcase" aria-label="About WAEC field operations">
      <div className="ops-showcase__content">
        <p className="ops-showcase__eyebrow">WAEC field operations</p>
        <h2 className="ops-showcase__title">Every officer, every centre, in one place</h2>
        <p className="ops-showcase__desc">
          Verify arrival at accredited centres and coordinate incidents from one operations view.
        </p>

        <div className="ops-showcase__list">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <div className="ops-showcase__item" key={title}>
              <span className="ops-showcase__icon" aria-hidden>
                <Icon className="size-5" strokeWidth={1.5} />
              </span>
              <div>
                <div className="ops-showcase__item-title">{title}</div>
                <p className="ops-showcase__item-text">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="ops-showcase__moment">
          <div className="ops-showcase__moment-header">
            <span className="ops-showcase__moment-title">Centre perimeter check</span>
            <span className="ops-showcase__moment-meta">150 m rule</span>
          </div>
          <div className="ops-showcase__moment-row">
            <span className="ops-showcase__dot" aria-hidden />
            <div>
              <div className="ops-showcase__moment-value">Inside the centre perimeter</div>
              <p className="ops-showcase__moment-label">
                Arrival is confirmed only when the phone reports from within the approved radius.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="ops-showcase__footer">
        <span className="ops-showcase__signature">
          <span className="ops-showcase__dot" aria-hidden />
          Verified at centre
        </span>
        <span>The West African Examinations Council</span>
      </div>
    </aside>
  )
}
