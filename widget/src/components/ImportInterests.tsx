interface Props {
  interests: string[];
  shared_interests?: string[];
  related_interests?: string[];
}

export default function ImportInterests({ interests, shared_interests = [], related_interests = [] }: Props) {
  return <>
    {interests.length > 0 && <span className="muted small">Interests: {interests.join(", ")}</span>}
    {shared_interests.length > 0 && <span className="small">In common: {shared_interests.join(", ")}</span>}
    {related_interests.length > 0 && <span className="small">Related interests: {related_interests.join(", ")}</span>}
  </>;
}
