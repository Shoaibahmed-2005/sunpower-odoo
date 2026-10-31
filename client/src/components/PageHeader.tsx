interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-sp6">
      <h1 className="font-heading text-2xl font-semibold text-text">{title}</h1>
      {actions && <div>{actions}</div>}
    </div>
  );
}
