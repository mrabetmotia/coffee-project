import { Button } from '@/components/ui/button';

export function Pagination({
  page,
  total,
  take,
  onPageChange,
}: {
  page: number;
  total: number;
  take: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / take));
  if (total <= take) return null;

  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
        Précédent
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page + 1}/{totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        Suivant
      </Button>
    </div>
  );
}
