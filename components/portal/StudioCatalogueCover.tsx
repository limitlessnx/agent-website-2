import Image from "next/image";

const legacyCoverBase = "https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/";
const originalCoverIds = {
  "portraits": "95738f74-ea60-4bee-966e-4793b5eb329b",
  "weddings": "aa01f92d-539a-4161-877f-ea1b913a7023",
  "maternity": "8b7e8e35-c9af-4e51-82eb-5ee8265bb402",
  "birthdays": "8f7a578b-3764-4639-b9ff-1ee2cf07737e",
  "family": "c8335b55-b572-4b49-9a15-e45ff5308c79",
  "creative-sets": "f1817634-6c77-4c9f-9a9a-58b8999bc02e",
};
const bundledCovers = new Map<string, string>(Object.entries(originalCoverIds).flatMap(([category, id]) => {
  const cover = `/exposure/${category}-v2.webp`;
  return [
    [`${legacyCoverBase}${id}.jpg`, cover],
    [`/exposure/${category}.jpg`, cover],
  ] as const;
}));

export default function StudioCatalogueCover({ source }: { source: string }) {
  const src = bundledCovers.get(source) ?? source;
  return (
    <Image
      className="exposure-catalogue-art"
      src={src}
      alt=""
      width={640}
      height={480}
      sizes="(max-width: 430px) 130px, 142px"
      unoptimized={!src.startsWith("/exposure/")}
    />
  );
}
