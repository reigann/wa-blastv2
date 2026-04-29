import { Table } from 'react-bootstrap';

export default function DataTable({ columns, rows, renderRow, hover = true }) {
  return (
    <div className="table-responsive">
      <Table hover={hover} striped={false} className="align-middle">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.hideOnMobile ? `table-mobile-hide ${col.className || ''}` : col.className || ''}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((row, index) => renderRow(row, index))}</tbody>
      </Table>
    </div>
  );
}
