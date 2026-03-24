export const combineSections = (data) => {
  return data.data.sections
    .map(
      (section) =>
        `<section>` +
        `<h1>${section.title}</h1>` +
        `${section.content.data}` +
        `</section>`,
    )
    .join("");
};
