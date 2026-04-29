import { Badge, Card } from 'react-bootstrap';

export default function KPICard({ icon, label, value, trend, trendType = 'up' }) {
  return (
    <Card className="surface-card hover-lift h-100">
      <Card.Body className="p-3 p-lg-4">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <span className="kpi-icon-circle" aria-hidden="true">
            <i className={`bi ${icon}`} />
          </span>
          {trend ? (
            <Badge bg={trendType === 'down' ? 'danger' : 'success'}>
              {trendType === 'down' ? '-' : '+'}{trend}
            </Badge>
          ) : null}
        </div>
        <div className="fs-2 fw-bold" role="status">
          {value}
        </div>
        <div className="text-secondary" style={{ fontSize: 13 }}>
          {label}
        </div>
      </Card.Body>
    </Card>
  );
}
