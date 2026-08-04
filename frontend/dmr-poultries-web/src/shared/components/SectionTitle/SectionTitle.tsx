type Props = {
  title: string;
};

function SectionTitle({ title }: Props) {
  return (
    <h2 className="text-2xl font-bold text-slate-800 mb-5">
      {title}
    </h2>
  );
}

export default SectionTitle;