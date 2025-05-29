export function formatNameList(names) {
  const firstNameCounts = names.reduce((acc, fullName) => {
    const firstName = fullName.split(' ')[0];
    acc[firstName] = (acc[firstName] || 0) + 1;
    return acc;
  }, {});

  return names.map(fullName => {
    const [first, last] = fullName.split(' ');
    const needsInitial = firstNameCounts[first] > 1;
    return needsInitial && last ? `${first} ${last[0]}.` : first;
  });
}
