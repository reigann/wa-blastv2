import { Button } from 'react-bootstrap';

export default function EmptyState({ icon = 'bi-inbox', title, description, ctaLabel, onCta }) {
  return (
    <div className="empty-state">
      <i className={`bi ${icon}`} style={{ fontSize: 36, color: 'var(--text-muted)' }} />
      <h3 className="mt-3 mb-2">{title}</h3>
      {description ? <p className="mb-3">{description}</p> : null}
      {ctaLabel ? (
        <Button onClick={onCta} className="px-4">
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
