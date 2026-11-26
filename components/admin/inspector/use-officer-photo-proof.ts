'use client'

/**
 * HQ's photo viewer must show the photo that actually answered a proof
 * request, not just the officer's newest upload. This hook resolves the link
 * stored in `photo_requests.evidence_id` before the bytes are streamed.
 */

import { useEffect, useState } from 'react'
import {
  evidencePhotoUrl,
  selectFulfillmentEvidenceId,
  type EvidenceCandidate,
  type PhotoProofRequestLink,
} from '@/lib/field/evidence-link'

export interface OfficerPhotoMeta {
  id: string
  watermark: string
  createdAt: string
}

export interface OfficerPhotoProof {
  evidenceId: string | null
  meta: OfficerPhotoMeta | null
  url: string | null
}

export function useOfficerPhotoProof(officerId?: string | null): OfficerPhotoProof {
  const [state, setState] = useState<OfficerPhotoProof>({
    evidenceId: null,
    meta: null,
    url: null,
  })

  useEffect(() => {
    setState({ evidenceId: null, meta: null, url: null })
    if (!officerId) return

    let cancelled = false
    const query = encodeURIComponent(officerId)

    Promise.all([
      fetch(`/api/field/evidence?officerId=${query}`, { credentials: 'include' }),
      fetch(`/api/field/photo-request?officerId=${query}`, { credentials: 'include' }),
    ])
      .then(async ([evidenceRes, requestRes]) => {
        const [evidenceData, requestData] = await Promise.all([
          evidenceRes.ok ? evidenceRes.json().catch(() => null) : null,
          requestRes.ok ? requestRes.json().catch(() => null) : null,
        ])
        if (cancelled) return

        const candidates: EvidenceCandidate[] = Array.isArray(evidenceData?.photos)
          ? evidenceData.photos
              .filter((p: any) => p?.id && p?.officerId && p?.createdAt)
              .map((p: any) => ({
                id: String(p.id),
                officerId: String(p.officerId),
                createdAt: p.createdAt,
              }))
          : []
        const request: PhotoProofRequestLink | null = Array.isArray(requestData?.requests)
          ? (requestData.requests.find((r: any) => r?.officerId === officerId) || null)
          : null
        const pinnedId = request ? selectFulfillmentEvidenceId(request, candidates) : null
        const chosen = candidates.find((p) => p.id === pinnedId) || candidates[0]

        if (!chosen) {
          setState({ evidenceId: null, meta: null, url: null })
          return
        }
        const raw = (evidenceData?.photos || []).find((p: any) => String(p?.id) === chosen.id)
        setState({
          evidenceId: chosen.id,
          meta: {
            id: chosen.id,
            watermark: String(raw?.watermark || ''),
            createdAt: String(raw?.createdAt || chosen.createdAt),
          },
          url: evidencePhotoUrl(officerId, chosen.id),
        })
      })
      .catch(() => {
        if (!cancelled) setState({ evidenceId: null, meta: null, url: null })
      })

    return () => {
      cancelled = true
    }
  }, [officerId])

  return state
}
