interface OrnateSwordProps {
  className?: string;
}

export function OrnateSword({ className = "" }: OrnateSwordProps) {
  return (
    <span className={`ornate-sword ${className}`.trim()} aria-hidden="true">
      <span className="ornate-sword-trails"><i /><i /><i /></span>
      <span className="ornate-sword-pommel"><i /></span>
      <span className="ornate-sword-grip"><i /><i /><i /></span>
      <span className="ornate-sword-guard">
        <i className="guard-knot" />
        <i className="guard-flame guard-flame-upper" />
        <i className="guard-flame guard-flame-lower" />
        <i className="guard-hook guard-hook-upper" />
        <i className="guard-hook guard-hook-lower" />
      </span>
      <span className="ornate-sword-blade"><i /></span>
    </span>
  );
}
