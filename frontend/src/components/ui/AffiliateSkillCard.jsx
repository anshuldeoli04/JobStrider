import React from 'react';
import { ExternalLink, BookOpen, Sparkles, Award } from 'lucide-react';

export function AffiliateSkillCard({ track }) {
  if (!track) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--card-hover)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BookOpen size={17} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {track.title}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--accent-glow)',
                color: 'var(--accent)',
              }}
            >
              {track.badge || 'Partner'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
            {track.provider} • Bridge gap in <strong>{track.tag}</strong>
          </div>
        </div>
      </div>

      <a
        href={track.url}
        target="_blank"
        rel="noopener noreferrer"
        className="button button-sm button-secondary"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: '0.78rem',
          textDecoration: 'none',
        }}
      >
        View Course <ExternalLink size={13} />
      </a>
    </div>
  );
}

export function MockInterviewCard({ partner }) {
  if (!partner) return null;

  return (
    <div
      style={{
        marginTop: 14,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.06))',
        border: '1px solid rgba(168, 85, 247, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(168, 85, 247, 0.2)',
              color: '#c084fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {partner.title}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginTop: 2 }}>
              {partner.description}
            </div>
          </div>
        </div>

        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="button button-sm button-primary"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.82rem',
            textDecoration: 'none',
          }}
        >
          Book Session <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
