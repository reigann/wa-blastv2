import { Card, Placeholder } from 'react-bootstrap';

export default function SkeletonCard() {
  return (
    <Card className="surface-card h-100">
      <Card.Body>
        <Placeholder as="div" animation="glow">
          <Placeholder xs={6} />
        </Placeholder>
        <Placeholder as="div" animation="glow" className="mt-3">
          <Placeholder xs={10} />
          <Placeholder xs={8} />
          <Placeholder xs={7} />
        </Placeholder>
      </Card.Body>
    </Card>
  );
}
