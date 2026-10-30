export default function Icon({ name }: { name: string }) {
  return (
    <img
      className="icon"
      src={`https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/${name}.svg`}
      width="20"
      height="20"
      alt=""
      aria-hidden="true"
    />
  );
}
