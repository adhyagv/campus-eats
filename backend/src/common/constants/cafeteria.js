const CAFETERIAS = [
  {
    id: "bengaluru",
    name: "Bengaluru Cafe",
    aliases: ["Bengaluru", "Main Cafeteria"],
  },
  {
    id: "pesucafe",
    name: "Cafe PESU",
    aliases: ["PESU Cafe"],
  },
  {
    id: "nonveg",
    name: "Non-Veg Cafeteria",
    aliases: ["Nonveg"],
  },
];

function normalizeCafeteriaText(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
}

function resolveCafeteria(value, id) {
  const normalizedId = normalizeCafeteriaText(id);
  const normalizedName = normalizeCafeteriaText(value);
  const cafeteria = CAFETERIAS.find(
    (entry) =>
      entry.id === normalizedId ||
      normalizeCafeteriaText(entry.name) === normalizedName ||
      entry.aliases.some(
        (alias) => normalizeCafeteriaText(alias) === normalizedName
      )
  );

  if (cafeteria) {
    return { id: cafeteria.id, name: cafeteria.name };
  }

  return {
    id: normalizedId || normalizedName,
    name: typeof value === "string" ? value.trim() : "",
  };
}

function getCafeteriaAliases(value, id) {
  const resolved = resolveCafeteria(value, id);
  const cafeteria = CAFETERIAS.find((entry) => entry.id === resolved.id);
  return cafeteria ? [cafeteria.name, ...cafeteria.aliases] : [resolved.name];
}

module.exports = {
  getCafeteriaAliases,
  resolveCafeteria,
};
