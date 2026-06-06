const members = [
  { memberCode: 'M001', name: 'Ali Ahmadi' },
  { memberCode: 'M002', name: 'Sara Mohammadi' },
  { memberCode: 'M003', name: 'Reza Karimi' },
  { memberCode: 'M004', name: 'Maryam Hosseini' },
  { memberCode: 'M005', name: 'Hassan Rahimi' },
  { memberCode: 'M006', name: 'Fatemeh Nazari' },
  { memberCode: 'M007', name: 'Mohammad Jafari' },
  { memberCode: 'M008', name: 'Zahra Akbari' },
  { memberCode: 'M009', name: 'Amir Sadeghi' },
  { memberCode: 'M010', name: 'Narges Farhadi' },
  { memberCode: 'M011', name: 'Omid Bahrami' },
  { memberCode: 'M012', name: 'Leila Ghasemi' },
  { memberCode: 'M013', name: 'Babak Moradi' },
  { memberCode: 'M014', name: 'Parisa Ebrahimi' },
  { memberCode: 'M015', name: 'Kaveh Rostami' },
  { memberCode: 'M016', name: 'Shirin Tavakoli' },
  { memberCode: 'M017', name: 'Arash Nouri' },
  { memberCode: 'M018', name: 'Mahsa Danesh' },
  { memberCode: 'M019', name: 'Pouya Shafiei' },
  { memberCode: 'M020', name: 'Neda Asadi' },
  { memberCode: 'M021', name: 'Hamid Salehi' },
  { memberCode: 'M022', name: 'Roya Mousavi' },
];

function findMemberByCode(memberCode) {
  return members.find((m) => m.memberCode === memberCode) || null;
}

function getMembers() {
  return { members };
}

module.exports = { members, findMemberByCode, getMembers };
