// "This day in history": one well-documented event for every day of the year, written out so it works offline. window.OTD.on(date) -> { y, t } (y is the year as text, e.g. "1969" or "49 BC").
(function () {
  const RAW = `
01-01|1801|Giuseppe Piazzi discovers Ceres, the first asteroid (now a dwarf planet).
01-02|1959|The Soviet probe Luna 1 is launched and becomes the first spacecraft to pass the Moon.
01-03|1777|Washington wins the Battle of Princeton in the American Revolution.
01-04|1948|Burma becomes independent from Britain.
01-05|1914|Henry Ford announces a $5 day for assembly-line workers, more than double the usual wage.
01-06|1066|Harold Godwinson is crowned King of England, the year of the Norman Conquest.
01-07|1610|Galileo sees three of Jupiter's moons for the first time.
01-08|1790|George Washington delivers the first State of the Union address.
01-09|2007|Steve Jobs unveils the first iPhone.
01-10|49 BC|Julius Caesar leads his army across the Rubicon, starting a civil war.
01-11|1935|Amelia Earhart begins the first solo flight from Hawaii to California.
01-12|1970|Biafra surrenders, ending the Nigerian Civil War.
01-13|1898|Émile Zola's open letter "J'Accuse" is published, defending Alfred Dreyfus.
01-14|2005|The Huygens probe lands on Titan, the farthest landing ever made.
01-15|2001|Wikipedia goes online.
01-16|1547|Ivan IV is crowned, the first Tsar of Russia.
01-17|1773|Captain Cook's ships become the first to cross the Antarctic Circle.
01-18|1778|Captain Cook becomes the first European to see the Hawaiian Islands.
01-19|1983|Apple announces the Lisa, an early computer with a graphical interface and a mouse.
01-20|1981|Ronald Reagan is inaugurated and Iran frees 52 American hostages after 444 days.
01-21|1954|USS Nautilus, the first nuclear-powered submarine, is launched.
01-22|1924|Ramsay MacDonald takes office as leader of Britain's first Labour government.
01-23|1849|Elizabeth Blackwell becomes the first woman in the US to earn a medical degree.
01-24|1848|James Marshall finds gold at Sutter's Mill, starting the California Gold Rush.
01-25|1924|The first Winter Olympics open in Chamonix, France.
01-26|1788|The First Fleet arrives at Sydney Cove, beginning British settlement in Australia.
01-27|1945|Soviet troops liberate the Auschwitz concentration camp.
01-28|1986|The space shuttle Challenger breaks apart 73 seconds after launch.
01-29|1861|Kansas becomes the 34th US state.
01-30|1948|Mahatma Gandhi is assassinated in New Delhi.
01-31|1961|Ham the chimpanzee is launched into space on a Mercury test flight and returns safely.
02-01|2003|The space shuttle Columbia breaks apart on re-entry.
02-02|1943|German forces surrender at Stalingrad, a turning point of World War II.
02-03|1959|Buddy Holly, Ritchie Valens and The Big Bopper die in a plane crash, "the day the music died".
02-04|2004|Mark Zuckerberg launches Facebook from a Harvard dorm room.
02-05|1971|Apollo 14 lands on the Moon.
02-06|1952|Elizabeth II becomes Queen on the death of her father, George VI.
02-07|1964|The Beatles arrive in the US for the first time.
02-08|1587|Mary, Queen of Scots, is executed at Fotheringhay Castle.
02-09|1964|The Beatles perform on The Ed Sullivan Show to about 73 million viewers.
02-10|1996|IBM's Deep Blue becomes the first computer to win a game against a reigning world chess champion, Garry Kasparov.
02-11|1990|Nelson Mandela is released after 27 years in prison.
02-12|1809|Abraham Lincoln and Charles Darwin are both born on the same day.
02-13|1633|Galileo arrives in Rome to face the Inquisition.
02-14|1876|Alexander Graham Bell and Elisha Gray both file for a telephone patent on the same day.
02-15|1564|Galileo Galilei is born in Pisa.
02-16|1923|Howard Carter opens the burial chamber of Tutankhamun.
02-17|1600|Giordano Bruno is burned at the stake in Rome.
02-18|1930|Clyde Tombaugh confirms the discovery of Pluto from photographic plates.
02-19|1473|Nicolaus Copernicus is born in Toruń.
02-20|1962|John Glenn becomes the first American to orbit the Earth.
02-21|1848|The Communist Manifesto is first published in London.
02-22|1732|George Washington is born.
02-23|1954|The first mass trials of Jonas Salk's polio vaccine begin in Pittsburgh.
02-24|1582|Pope Gregory XIII issues the decree that introduces the Gregorian calendar.
02-25|1836|Samuel Colt patents the revolver.
02-26|1815|Napoleon escapes from exile on Elba.
02-27|1933|The Reichstag building in Berlin is set on fire.
02-28|1953|Francis Crick and James Watson work out the double-helix structure of DNA.
02-29|1504|Columbus uses a predicted lunar eclipse to persuade the people of Jamaica to feed his crew.
03-01|1872|Yellowstone becomes the world's first national park.
03-02|1969|The Concorde makes its first flight.
03-03|1931|"The Star-Spangled Banner" becomes the national anthem of the United States.
03-04|1789|The US Constitution takes effect and the first Congress meets in New York.
03-05|1770|British soldiers kill five colonists in the Boston Massacre.
03-06|1836|The Alamo falls to Mexican forces after a 13-day siege.
03-07|1876|Alexander Graham Bell is granted the patent for the telephone.
03-08|1917|Protests on International Women's Day in Petrograd start the Russian February Revolution.
03-09|1959|The Barbie doll debuts at the New York Toy Fair.
03-10|1876|Bell makes the first telephone call: "Mr. Watson, come here, I want to see you."
03-11|1888|The Great Blizzard of 1888 buries the northeastern US.
03-12|1930|Gandhi begins the Salt March to protest the British salt tax.
03-13|1781|William Herschel discovers the planet Uranus.
03-14|1879|Albert Einstein is born in Ulm, Germany.
03-15|44 BC|Julius Caesar is assassinated by senators on the Ides of March.
03-16|1926|Robert Goddard launches the first liquid-fuelled rocket.
03-17|180|Roman emperor Marcus Aurelius dies.
03-18|1965|Alexei Leonov makes the first spacewalk.
03-19|1918|Congress approves standard time zones and daylight saving time in the US.
03-20|1916|Einstein publishes his general theory of relativity.
03-21|1963|Alcatraz federal penitentiary closes.
03-22|1895|The Lumière brothers show their first film to a private audience in Paris.
03-23|1775|Patrick Henry delivers his "Give me liberty, or give me death" speech.
03-24|1882|Robert Koch announces his discovery of the bacterium that causes tuberculosis.
03-25|1807|The British Parliament abolishes the slave trade across the empire.
03-26|1953|Jonas Salk announces his successful polio vaccine.
03-27|1977|Two jumbo jets collide at Tenerife, the deadliest accident in aviation history.
03-28|1979|The Three Mile Island nuclear accident begins in Pennsylvania.
03-29|1973|The last US combat troops leave Vietnam.
03-30|1853|Vincent van Gogh is born in the Netherlands.
03-31|1889|The Eiffel Tower is officially opened in Paris.
04-01|1976|Steve Jobs, Steve Wozniak and Ronald Wayne found Apple.
04-02|1513|Juan Ponce de León sights Florida.
04-03|1973|Martin Cooper of Motorola makes the first call on a handheld mobile phone.
04-04|1968|Martin Luther King Jr. is assassinated in Memphis.
04-05|1722|Dutch explorer Jacob Roggeveen becomes the first European to reach Easter Island, on Easter Sunday.
04-06|1896|The first modern Olympic Games open in Athens.
04-07|1948|The World Health Organization is founded.
04-08|1911|Heike Kamerlingh Onnes discovers superconductivity.
04-09|1865|Robert E. Lee surrenders at Appomattox, effectively ending the US Civil War.
04-10|1912|The Titanic leaves Southampton on her maiden voyage.
04-11|1970|Apollo 13 is launched.
04-12|1961|Yuri Gagarin becomes the first human in space.
04-13|1970|An oxygen tank explodes on Apollo 13: "Houston, we've had a problem."
04-14|1912|The Titanic strikes an iceberg in the North Atlantic.
04-15|1912|The Titanic sinks, with more than 1,500 lives lost.
04-16|1862|Lincoln signs the act that ends slavery in the District of Columbia.
04-17|1970|The crew of Apollo 13 splash down safely.
04-18|1906|A great earthquake and fire devastate San Francisco.
04-19|1775|The first shots of the American Revolution are fired at Lexington and Concord.
04-20|1902|Marie and Pierre Curie isolate radium chloride.
04-21|753 BC|The traditional founding date of Rome.
04-22|1970|The first Earth Day is held.
04-23|1616|William Shakespeare and Miguel de Cervantes both die.
04-24|1990|The Hubble Space Telescope is launched.
04-25|1953|Watson and Crick publish the structure of DNA in Nature.
04-26|1986|The Chernobyl nuclear disaster begins.
04-27|1521|Ferdinand Magellan is killed in the Philippines.
04-28|1789|The crew of HMS Bounty mutinies against Captain Bligh.
04-29|1429|Joan of Arc arrives at Orléans, which was under English siege.
04-30|1789|George Washington is inaugurated as the first US president.
05-01|1931|The Empire State Building opens in New York.
05-02|1519|Leonardo da Vinci dies in France.
05-03|1469|Niccolò Machiavelli is born in Florence.
05-04|1886|A bomb explodes at a labour rally in Chicago's Haymarket Square.
05-05|1961|Alan Shepard becomes the first American in space.
05-06|1937|The airship Hindenburg burns at Lakehurst, New Jersey.
05-07|1824|Beethoven's Ninth Symphony premieres in Vienna.
05-08|1945|Victory in Europe Day: Germany's surrender takes effect.
05-09|1914|President Wilson proclaims the first national Mother's Day.
05-10|1869|The first transcontinental railroad in the US is completed at Promontory Summit, Utah.
05-11|1997|IBM's Deep Blue defeats Garry Kasparov in a six-game chess match.
05-12|1949|The Soviet Union lifts the Berlin Blockade.
05-13|1940|Winston Churchill tells Parliament: "I have nothing to offer but blood, toil, tears and sweat."
05-14|1948|Israel declares independence.
05-15|1930|Ellen Church becomes the first airline flight attendant.
05-16|1929|The first Academy Awards ceremony is held in Hollywood.
05-17|1954|The US Supreme Court rules school segregation unconstitutional in Brown v. Board of Education.
05-18|1980|Mount St. Helens erupts in Washington State.
05-19|1536|Anne Boleyn is executed.
05-20|1927|Charles Lindbergh takes off from New York to fly solo across the Atlantic.
05-21|1927|Lindbergh lands in Paris after 33 and a half hours.
05-22|1960|The largest earthquake ever recorded, magnitude 9.5, strikes Chile.
05-23|1498|Girolamo Savonarola is burned at the stake in Florence.
05-24|1844|Samuel Morse sends "What hath God wrought" by telegraph from Washington to Baltimore.
05-25|1977|Star Wars opens in US theaters.
05-26|1940|Operation Dynamo begins: the evacuation of Allied troops from Dunkirk.
05-27|1937|The Golden Gate Bridge opens to pedestrians.
05-28|1987|Mathias Rust, a teenage pilot, lands a small plane in Moscow's Red Square.
05-29|1953|Edmund Hillary and Tenzing Norgay reach the summit of Mount Everest.
05-30|1431|Joan of Arc is burned at the stake in Rouen.
05-31|1889|The Johnstown Flood kills more than 2,200 people in Pennsylvania.
06-01|1980|CNN launches as the first 24-hour television news channel.
06-02|1953|Elizabeth II is crowned in Westminster Abbey.
06-03|1965|Ed White becomes the first American to walk in space.
06-04|1783|The Montgolfier brothers give the first public demonstration of a hot-air balloon.
06-05|1967|The Six-Day War begins in the Middle East.
06-06|1944|D-Day: Allied forces land on the beaches of Normandy.
06-07|1494|Spain and Portugal sign the Treaty of Tordesillas, dividing the newly explored world between them.
06-08|1949|George Orwell's novel Nineteen Eighty-Four is published.
06-09|68|Roman emperor Nero dies.
06-10|1935|Alcoholics Anonymous is founded in Akron, Ohio.
06-11|1770|Captain Cook's Endeavour runs aground on the Great Barrier Reef.
06-12|1979|The Gossamer Albatross completes the first human-powered flight across the English Channel.
06-13|1983|Pioneer 10 crosses the orbit of Neptune, the first spacecraft to leave the planetary region of the solar system.
06-14|1777|The Continental Congress adopts the Stars and Stripes as the US flag.
06-15|1215|King John seals Magna Carta at Runnymede.
06-16|1963|Valentina Tereshkova becomes the first woman in space.
06-17|1885|The Statue of Liberty arrives in New York Harbor, in crates.
06-18|1815|Napoleon is defeated at the Battle of Waterloo.
06-19|1865|Union troops arrive in Galveston, Texas, to announce the end of slavery, the origin of Juneteenth.
06-20|1963|The US and the Soviet Union agree to set up the Moscow–Washington hotline.
06-21|1788|New Hampshire ratifies the US Constitution, bringing it into force.
06-22|1633|Galileo is forced to renounce his belief that the Earth moves around the Sun.
06-23|1912|Alan Turing is born in London.
06-24|1947|Pilot Kenneth Arnold reports nine shining objects near Mount Rainier, coining "flying saucer".
06-25|1876|Custer's forces are defeated at the Battle of the Little Bighorn.
06-26|1945|The Charter of the United Nations is signed in San Francisco.
06-27|1954|The Obninsk plant in the USSR becomes the first nuclear power plant to supply a power grid.
06-28|1914|Archduke Franz Ferdinand is assassinated in Sarajevo, setting off World War I.
06-29|1613|Fire destroys the original Globe Theatre in London during a performance of Henry VIII.
06-30|1908|The Tunguska event flattens some 2,000 square kilometres of Siberian forest.
07-01|1867|Canada becomes a self-governing dominion.
07-02|1776|The Continental Congress votes in favour of independence.
07-03|1608|Samuel de Champlain founds Quebec City.
07-04|1776|The Declaration of Independence is adopted.
07-05|1996|Dolly the sheep, the first mammal cloned from an adult cell, is born.
07-06|1885|Louis Pasteur gives the first successful rabies vaccine to a boy.
07-07|1928|Sliced bread is sold for the first time, in Chillicothe, Missouri.
07-08|1497|Vasco da Gama sets sail from Lisbon on the first sea voyage from Europe to India.
07-09|1816|Argentina declares independence from Spain.
07-10|1962|Telstar, the first communications satellite to relay live television, is launched.
07-11|1960|To Kill a Mockingbird by Harper Lee is published.
07-12|1543|Henry VIII marries his sixth wife, Catherine Parr.
07-13|1985|Live Aid concerts are held in London and Philadelphia.
07-14|1789|A Paris crowd storms the Bastille.
07-15|1799|French soldiers find the Rosetta Stone in Egypt.
07-16|1969|Apollo 11 launches from Cape Kennedy toward the Moon.
07-17|1955|Disneyland opens in California.
07-18|64|The Great Fire of Rome begins.
07-19|1848|The Seneca Falls Convention on women's rights opens in New York.
07-20|1969|Apollo 11 lands on the Moon.
07-21|1925|John Scopes is found guilty of teaching evolution in Tennessee.
07-22|1933|Wiley Post completes the first solo flight around the world.
07-23|1903|The Ford Motor Company sells its first car, a Model A.
07-24|1911|Hiram Bingham reaches Machu Picchu in Peru.
07-25|1978|Louise Brown, the first baby born through in-vitro fertilization, is born in England.
07-26|1947|The National Security Act creates the CIA and the Department of Defense.
07-27|1940|Bugs Bunny makes his official debut in "A Wild Hare".
07-28|1914|Austria-Hungary declares war on Serbia, the start of World War I.
07-29|1958|President Eisenhower signs the law creating NASA.
07-30|1930|Uruguay wins the first FIFA World Cup.
07-31|1971|Apollo 15 astronauts drive the first lunar rover on the Moon.
08-01|1498|Columbus sights the mainland of South America.
08-02|1990|Iraq invades Kuwait.
08-03|1492|Columbus sets sail from Palos, Spain, on his first voyage.
08-04|1944|Anne Frank and her family are arrested in Amsterdam.
08-05|1962|Nelson Mandela is arrested in South Africa.
08-06|1945|The atomic bomb is dropped on Hiroshima.
08-07|1959|Explorer 6 sends back the first photograph of Earth from space.
08-08|1974|Richard Nixon announces his resignation.
08-09|1945|The atomic bomb is dropped on Nagasaki.
08-10|1821|Missouri becomes the 24th US state.
08-11|1999|A total solar eclipse crosses Europe and the Middle East.
08-12|1981|IBM introduces its Personal Computer.
08-13|1961|East Germany begins building the Berlin Wall.
08-14|1945|Japan announces its surrender, ending World War II.
08-15|1969|The Woodstock festival opens in New York State.
08-16|1977|Elvis Presley dies at Graceland.
08-17|1978|Double Eagle II completes the first balloon crossing of the Atlantic.
08-18|1920|The 19th Amendment, giving American women the vote, is ratified.
08-19|1839|The French government announces the daguerreotype, the first practical photographic process.
08-20|1977|Voyager 2 is launched.
08-21|1959|Hawaii becomes the 50th US state.
08-22|1485|Richard III dies at the Battle of Bosworth Field, ending the Wars of the Roses.
08-23|1927|Sacco and Vanzetti are executed in Massachusetts.
08-24|2006|Pluto is reclassified as a dwarf planet.
08-25|1989|Voyager 2 makes its closest flyby of Neptune.
08-26|1789|France's National Assembly approves the Declaration of the Rights of Man and of the Citizen.
08-27|1883|Krakatoa erupts in the loudest sound in recorded history.
08-28|1963|Martin Luther King Jr. delivers "I Have a Dream" at the March on Washington.
08-29|1949|The Soviet Union tests its first atomic bomb.
08-30|1983|Guion Bluford becomes the first African American in space.
08-31|1997|Diana, Princess of Wales, dies in a car crash in Paris.
09-01|1939|Germany invades Poland, starting World War II in Europe.
09-02|1945|Japan formally surrenders aboard USS Missouri.
09-03|1783|The Treaty of Paris ends the American Revolutionary War.
09-04|1998|Larry Page and Sergey Brin incorporate Google.
09-05|1977|Voyager 1 is launched.
09-06|1522|The Victoria returns to Spain, completing the first circumnavigation of the globe.
09-07|1822|Brazil declares independence from Portugal.
09-08|1966|The first episode of Star Trek airs.
09-09|1776|The Continental Congress officially names the new country the United States of America.
09-10|2008|The Large Hadron Collider circulates its first beam of protons.
09-11|2001|Terrorist attacks destroy the World Trade Center and hit the Pentagon.
09-12|1940|Teenagers discover the Lascaux cave paintings in France.
09-13|1814|Francis Scott Key watches the bombardment of Fort McHenry and writes the poem that becomes the US national anthem.
09-14|1959|Luna 2 becomes the first spacecraft to reach the Moon.
09-15|1916|Tanks are used in battle for the first time, at the Somme.
09-16|1620|The Mayflower sails from Plymouth, England, for the New World.
09-17|1787|The US Constitution is signed in Philadelphia.
09-18|1851|The first edition of The New York Times is published.
09-19|1893|New Zealand becomes the first self-governing country to give women the vote.
09-20|1519|Magellan's fleet sets sail from Spain to circle the globe.
09-21|1937|J.R.R. Tolkien's The Hobbit is published.
09-22|1862|Lincoln issues the preliminary Emancipation Proclamation.
09-23|1846|Johann Galle observes Neptune, where Le Verrier had predicted it would be.
09-24|1789|Congress passes the Judiciary Act, setting up the federal court system.
09-25|1789|Congress sends the Bill of Rights to the states.
09-26|1580|Francis Drake returns to England, completing his circumnavigation.
09-27|1825|The Stockton and Darlington Railway opens in England, the first public steam railway.
09-28|1928|Alexander Fleming notices the mould that leads to penicillin.
09-29|1829|Robert Peel's new Metropolitan Police, the "bobbies", begin patrolling London.
09-30|1938|Britain, France, Germany and Italy sign the Munich Agreement.
10-01|1908|Ford introduces the Model T.
10-02|1950|The comic strip Peanuts debuts.
10-03|1990|East and West Germany reunify.
10-04|1957|The Soviet Union launches Sputnik 1, the first artificial satellite.
10-05|1962|The first James Bond film, Dr. No, premieres in London.
10-06|1927|The Jazz Singer opens, the first feature film with synchronised dialogue.
10-07|1571|A Christian fleet defeats the Ottoman navy at the Battle of Lepanto.
10-08|1871|The Great Chicago Fire begins.
10-09|1446|King Sejong promulgates Hangul, the Korean alphabet.
10-10|1911|The Wuchang Uprising begins the revolution that ends imperial rule in China.
10-11|1968|Apollo 7, the first crewed Apollo mission, is launched.
10-12|1492|Columbus reaches the Americas.
10-13|1307|King Philip IV of France has the Knights Templar arrested, a Friday the 13th.
10-14|1066|William of Normandy defeats King Harold at the Battle of Hastings.
10-15|1582|The Gregorian calendar takes effect in Catholic countries: October 4 is followed by October 15.
10-16|1793|Marie Antoinette is executed.
10-17|1777|The British surrender at Saratoga, a turning point of the American Revolution.
10-18|1867|The US formally takes possession of Alaska from Russia.
10-19|1781|Cornwallis surrenders at Yorktown.
10-20|1973|Queen Elizabeth II opens the Sydney Opera House.
10-21|1879|Thomas Edison tests the first practical incandescent light bulb.
10-22|1962|President Kennedy announces the naval quarantine of Cuba, the Cuban Missile Crisis.
10-23|1850|The first National Women's Rights Convention opens in Worcester, Massachusetts.
10-24|1929|Black Thursday: panic selling begins on the New York Stock Exchange.
10-25|1415|Henry V defeats the French at the Battle of Agincourt.
10-26|1881|The Gunfight at the O.K. Corral takes place in Tombstone, Arizona.
10-27|1904|New York City's first subway line opens.
10-28|1886|The Statue of Liberty is dedicated.
10-29|1969|The first message is sent over ARPANET, the ancestor of the internet.
10-30|1938|Orson Welles's radio drama "The War of the Worlds" is broadcast.
10-31|1517|Martin Luther is said to have posted his Ninety-five Theses in Wittenberg.
11-01|1512|Michelangelo's Sistine Chapel ceiling is shown to the public for the first time.
11-02|1936|The BBC begins the world's first regular high-definition television service.
11-03|1957|The Soviet Union launches Sputnik 2 with the dog Laika aboard.
11-04|1922|Howard Carter's team finds the first step leading to Tutankhamun's tomb.
11-05|1605|Guy Fawkes is arrested while guarding explosives beneath Parliament.
11-06|1860|Abraham Lincoln is elected president.
11-07|1917|The Bolsheviks seize power in Petrograd, the "October Revolution".
11-08|1895|Wilhelm Röntgen discovers X-rays.
11-09|1989|The Berlin Wall falls.
11-10|1871|Henry Morton Stanley finds David Livingstone: "Dr. Livingstone, I presume?"
11-11|1918|An armistice ends the fighting of World War I.
11-12|1980|Voyager 1 makes its closest approach to Saturn.
11-13|1940|Disney's Fantasia premieres in New York.
11-14|1969|Apollo 12 is launched; lightning strikes the rocket twice on the way up.
11-15|1777|The Continental Congress approves the Articles of Confederation.
11-16|1914|The US Federal Reserve Banks open for business.
11-17|1869|The Suez Canal opens.
11-18|1928|Steamboat Willie premieres, introducing Mickey Mouse to the public.
11-19|1863|Lincoln delivers the Gettysburg Address.
11-20|1945|The Nuremberg trials of Nazi leaders begin.
11-21|1783|The first untethered flight with human passengers, in a hot-air balloon, takes place in Paris.
11-22|1963|President John F. Kennedy is assassinated in Dallas.
11-23|1936|The first issue of Life magazine appears.
11-24|1859|Charles Darwin publishes On the Origin of Species.
11-25|1783|The last British troops leave New York City after the Revolutionary War.
11-26|1922|Howard Carter first looks into Tutankhamun's tomb: "Yes, wonderful things."
11-27|1895|Alfred Nobel signs the will that creates the Nobel Prizes.
11-28|1520|Magellan's ships enter the Pacific Ocean.
11-29|1947|The UN General Assembly votes to partition Palestine.
11-30|1872|The first international football match, Scotland against England, ends 0–0 in Glasgow.
12-01|1955|Rosa Parks refuses to give up her bus seat in Montgomery, Alabama.
12-02|1942|Enrico Fermi's team achieves the first controlled nuclear chain reaction in Chicago.
12-03|1967|Christiaan Barnard performs the first human heart transplant in Cape Town.
12-04|1872|The sailing ship Mary Celeste is found drifting with no one on board.
12-05|1933|Prohibition ends in the US as Utah ratifies the 21st Amendment.
12-06|1917|The Halifax Explosion devastates the Canadian city.
12-07|1941|Japan attacks Pearl Harbor.
12-08|1980|John Lennon is shot outside the Dakota in New York.
12-09|1968|Douglas Engelbart demonstrates the mouse and hypertext in "the mother of all demos".
12-10|1901|The first Nobel Prizes are awarded in Stockholm.
12-11|1946|The UN General Assembly creates UNICEF.
12-12|1901|Guglielmo Marconi receives the first transatlantic radio signal in Newfoundland.
12-13|1577|Francis Drake leaves Plymouth on the voyage that will take him around the world.
12-14|1911|Roald Amundsen's team becomes the first to reach the South Pole.
12-15|1791|The Bill of Rights is ratified.
12-16|1773|Colonists dump British tea into Boston Harbor in the Boston Tea Party.
12-17|1903|Orville and Wilbur Wright make the first powered, controlled airplane flights at Kitty Hawk.
12-18|1892|Tchaikovsky's ballet The Nutcracker premieres in St. Petersburg.
12-19|1843|Charles Dickens publishes A Christmas Carol.
12-20|1803|The Louisiana Purchase is formally transferred to the US in New Orleans.
12-21|1913|The first crossword puzzle appears, in the New York World.
12-22|1882|The first string of electric Christmas tree lights is displayed in New York.
12-23|1947|Bell Labs demonstrates the transistor.
12-24|1968|Apollo 8 enters orbit around the Moon; the crew photograph "Earthrise".
12-25|800|Charlemagne is crowned Emperor by Pope Leo III in Rome.
12-26|1991|The Soviet Union is formally dissolved.
12-27|1831|HMS Beagle sets sail with Charles Darwin aboard.
12-28|1895|The Lumière brothers hold the first paid public film screening in Paris.
12-29|1845|Texas is admitted as the 28th US state.
12-30|1922|The Soviet Union is formed.
12-31|1879|Thomas Edison gives the first public demonstration of his incandescent lamp at Menlo Park.
`;
  const MAP = {};
  RAW.split('\n').forEach(l => { const p = l.split('|'); if (p.length >= 3) MAP[p[0]] = { y: p[1], t: p.slice(2).join('|') }; });
  const pad = n => (n < 10 ? '0' : '') + n;
  /* years ago, or null when the year is not a plain number */
  const ago = (y, now) => { const n = parseInt(y, 10); if (!(n > 0)) return null; return /BC$/.test(y) ? now.getFullYear() + n - 1 : /^\d+$/.test(y) ? now.getFullYear() - n : null; };
  window.OTD = { on: d => { const e = MAP[pad(d.getMonth() + 1) + '-' + pad(d.getDate())]; return e ? { y: e.y, t: e.t, ago: ago(e.y, d) } : null; }, count: () => Object.keys(MAP).length };
})();
