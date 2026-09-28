"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
     UserCircle2,
     ClipboardList,
     CalendarClock,
     Activity,
} from "lucide-react";
import {
     Card,
     CardContent,
     CardDescription,
     CardHeader,
     CardTitle,
     CardFooter,
} from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { getNotes } from "@/services/notesApis";
import { getPatients } from "@/services/patientApis";
import {
     Bar,
     BarChart,
     PieChart,
     Pie,
     Cell,
     Label,
     CartesianGrid,
     XAxis,
     YAxis,
     ResponsiveContainer,
} from "recharts";

// Import shadcn chart components
import {
     ChartConfig,
     ChartContainer,
     ChartTooltip,
     ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { useRouter } from "next/navigation";
import { Patient } from "@/shared/types/patient.type";
import { Note } from "@/shared/types/note.type";

interface DashboardProps {
     isMobile: boolean;
     isTablet: boolean;
     setIsSidebarOpen: (isOpen: boolean) => void;
     onUploadComplete?: () => void;
}

// Fixed utility function
function generateNoteCountsByDay(notes: Note[]) {
     const dateCounts: Record<string, number> = {};

     notes.forEach((note) => {
          try {
               // Keep the date in ISO format for sorting and parsing
               const date = new Date(note.created_at);
               const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format
               dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
          } catch (err) {
               console.error("Error parsing date:", err);
          }
     });

     // Convert to array and sort by date
     return Object.entries(dateCounts)
          .map(([date, count]) => ({ date, count }))
          .sort(
               (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
}

const getFontSize = (isMobileView: boolean, isTabletView: boolean) => {
     if (isMobileView) return "text-2xl";
     if (isTabletView) return "text-3xl";
     return "text-xl";
}

const getLabelContent = (viewBox: any, totalNotes: number, isMobileView: boolean, isTabletView: boolean) => {
     if (
          viewBox &&
          "cx" in viewBox &&
          "cy" in viewBox
     ) {
          return (
               <text
                    x={
                         viewBox.cx
                    }
                    y={
                         viewBox.cy
                    }
                    textAnchor="middle"
                    dominantBaseline="middle"
               >
                    <tspan
                         x={
                              viewBox.cx
                         }
                         y={
                              viewBox.cy
                         }
                         className={`fill-foreground font-bold ${getFontSize(isMobileView, isTabletView)}`}
                    >
                         {totalNotes.toLocaleString()}
                    </tspan>
                    <tspan
                         x={
                              viewBox.cx
                         }
                         y={
                              (viewBox.cy ||
                                   0) +
                              (isMobileView
                                   ? 18
                                   : 24)
                         }
                         className="fill-muted-foreground text-xs md:text-sm"
                    >
                         Notes
                    </tspan>
               </text>
          );
     }
     return null;
}

// Card skeleton component for stat cards
const StatCardSkeleton = () => (
     <Card>
          <CardHeader>
               <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded" />
               </div>
               <Skeleton className="h-4 w-40 mt-1 rounded" />
          </CardHeader>
          <CardContent>
               <Skeleton className="h-8 w-16 rounded" />
          </CardContent>
     </Card>
);

// Chart skeleton component
const ChartSkeleton = () => (
     <Card>
          <CardHeader>
               <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="h-5 w-36 rounded" />
               </div>
          </CardHeader>
          <CardContent>
               <div className="flex justify-center items-center h-[250px] md:h-[300px]">
                    <Skeleton className="h-full w-full rounded" />
               </div>
          </CardContent>
     </Card>
);

const Dash: React.FC<DashboardProps> = ({
     isMobile,
     isTablet,
     setIsSidebarOpen,
     onUploadComplete
}) => {
     const router = useRouter();
     const [notes, setNotes] = useState<Note[]>([]);
     const [patients, setPatients] = useState<Patient[]>([]);
     const [isLoading, setIsLoading] = useState(true);
     const [windowWidth, setWindowWidth] = useState(
          typeof window !== "undefined" ? window.innerWidth : 0
     );

     // Responsive helper variables based on window width
     const isMobileView = windowWidth < 768;
     const isTabletView = windowWidth >= 768 && windowWidth < 1024;

     useEffect(() => {
          const handleResize = () => {
               setWindowWidth(window.innerWidth);
          };

          // Add event listener
          window.addEventListener("resize", handleResize);

          // Clean up
          return () => {
               window.removeEventListener("resize", handleResize);
          };
     }, []);

     useEffect(() => {
          const fetchData = async () => {
               try {
                    const [notesData, patientsData] = await Promise.all([
                         getNotes(),
                         getPatients(),
                    ]);
                    setNotes(notesData);
                    setPatients(patientsData);
               } catch (err) {
                    console.error("Error loading dashboard data:", err);
               } finally {
                    setIsLoading(false);
               }
          };

          fetchData();
     }, []);

     const noteStatusCount = notes.reduce(
          (acc: Record<string, number>, note) => {
               const status = (note.status || "Unknown").toLowerCase();
               acc[status] = (acc[status] || 0) + 1;
               return acc;
          },
          {}
     );

     // Format data for donut chart
     const donutChartData = Object.entries(noteStatusCount).map(
          ([key, value], index) => ({
               status: key.charAt(0).toUpperCase() + key.slice(1),
               count: value,
               fill: `var(--color-status-${index})`,
          })
     );

     // Calculate total notes for the center of donut chart
     const totalNotes = useMemo(() => {
          return donutChartData.reduce((acc, curr) => acc + curr.count, 0);
     }, [donutChartData]);

     // Prepare data for bar chart
     const barChartData = generateNoteCountsByDay(notes);

     // Chart configs for shadcn
     const barChartConfig = {
          count: {
               label: "Number of Notes",
               color: "hsl(var(--chart-1))",
          },
     } satisfies ChartConfig;

     // Create a config for the donut chart
     const donutChartConfig = {
          count: {
               label: "Number of Notes",
          },
          ...Object.fromEntries(
               Object.keys(noteStatusCount).map((status, index) => [
                    status,
                    {
                         label:
                              status.charAt(0).toUpperCase() + status.slice(1),
                         color: `hsl(var(--chart-${index + 1}))`,
                    },
               ])
          ),
     } satisfies ChartConfig;

     // Soft pastel colors that are easier on the eyes
     const pastelColors = [
          "#A7C7E7", // Soft blue
          "#C1E1C1", // Soft green
          "#FAE7B5", // Soft yellow
          "#FFC0CB", // Soft pink
          "#D8BFD8", // Soft purple
          "#FFE4C4", // Soft orange
     ];

     // Create custom CSS variables for the chart colors
     useEffect(() => {
          const root = document.documentElement;

          // Set colors for each status
          Object.keys(noteStatusCount).forEach((status, index) => {
               root.style.setProperty(
                    `--color-status-${index}`,
                    pastelColors[index % pastelColors.length]
               );
          });
     }, [noteStatusCount]);

     // Calculate the appropriate tick interval based on screen size and data length
     const getResponsiveTickInterval = useMemo(() => {
          if (isMobileView) return Math.ceil(barChartData.length / 3); // Show ~3 ticks on mobile
          if (isTabletView) return Math.ceil(barChartData.length / 5); // Show ~5 ticks on tablet
          return 0; // Show all ticks on desktop
     }, [barChartData.length, isMobileView, isTabletView]);


     return (
          <div className="h-full flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto">
               <ScrollArea className="h-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                         {isLoading ? (
                              // Skeleton state for stat cards
                              <>
                                   <StatCardSkeleton />
                                   <StatCardSkeleton />
                                   <StatCardSkeleton />
                              </>
                         ) : (
                              // Actual content
                              <>
                                   <Card
                                        data-test-id="patient-dashboard-card"
                                        onClick={(e) => {
                                             e.stopPropagation();
                                             router.push(
                                                  "/dashboard?tab=Patients"
                                             );
                                        }}
                                        className="hover:cursor-pointer"
                                   >
                                        <CardHeader className="hover:scale-105 transition-transform duration-200">
                                             <CardTitle className="flex items-center gap-2 text-lg">
                                                  <UserCircle2 className="w-5 h-5 text-blue-500" />
                                                  Patients
                                             </CardTitle>
                                             <CardDescription>
                                                  Active patients in your system
                                             </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                             <div className="text-3xl font-semibold">
                                                  {patients.length}
                                             </div>
                                        </CardContent>
                                   </Card>

                                   <Card
                                        onClick={(e) => {
                                             e.stopPropagation();
                                             router.push(
                                                  "/dashboard?tab=Notes"
                                             );
                                        }}
                                        className="hover:cursor-pointer"
                                   >
                                        <CardHeader className=" hover:scale-105 transition-transform duration-200">
                                             <CardTitle className="flex   items-center gap-2 text-lg">
                                                  <ClipboardList className="w-5 h-5 text-green-500" />
                                                  <div className="div  flex w-full items-center justify-between">
                                                       Notes
                                                  </div>
                                             </CardTitle>
                                             <CardDescription>
                                                  Total clinical notes
                                             </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                             <div className="text-3xl font-semibold">
                                                  {notes.length}
                                             </div>
                                        </CardContent>
                                   </Card>

                                   <Card>
                                        <CardHeader>
                                             <CardTitle className="flex items-center gap-2 text-lg">
                                                  <CalendarClock className="w-5 h-5 text-purple-500" />
                                                  Appointments
                                             </CardTitle>
                                             <CardDescription>
                                                  Upcoming appointments (coming
                                                  soon)
                                             </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                             <div className="text-md text-gray-500">
                                                  Integration in progress...
                                             </div>
                                        </CardContent>
                                   </Card>
                              </>
                         )}
                    </div>
                    {/* Analytics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                         {isLoading ? (
                              // Skeleton state for charts
                              <>
                                   <ChartSkeleton />
                                   <ChartSkeleton />
                              </>
                         ) : (
                              // Actual content
                              <>
                                   <Card className="flex flex-col">
                                        <CardHeader className="pb-0">
                                             <CardTitle className="flex items-center gap-2 text-lg">
                                                  <Activity className="w-5 h-5 text-yellow-500" />
                                                  Note Status Distribution
                                             </CardTitle>
                                             <CardDescription>
                                                  Status breakdown of all notes
                                             </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 pb-0">
                                             {donutChartData.length > 0 ? (
                                                  <div className="w-full h-[250px] md:h-[300px]">
                                                       <ChartContainer
                                                            config={
                                                                 donutChartConfig
                                                            }
                                                            className="w-full h-full"
                                                       >
                                                            <ResponsiveContainer
                                                                 width="100%"
                                                                 height="100%"
                                                            >
                                                                 <PieChart>
                                                                      <ChartTooltip
                                                                           cursor={
                                                                                false
                                                                           }
                                                                           content={
                                                                                <ChartTooltipContent
                                                                                     hideLabel
                                                                                />
                                                                           }
                                                                      />
                                                                      <Pie
                                                                           data={
                                                                                donutChartData
                                                                           }
                                                                           dataKey="count"
                                                                           nameKey="status"
                                                                           cx="50%"
                                                                           cy="50%"
                                                                           outerRadius="70%"
                                                                           innerRadius="50%"
                                                                           strokeWidth={
                                                                                5
                                                                           }
                                                                      >
                                                                           {donutChartData.map(
                                                                                (
                                                                                     entry,
                                                                                     index
                                                                                ) => (
                                                                                     <Cell
                                                                                          key={`cell-${index}`} //sonarqube gave error about not using index but cannot use entry as it only have 3 keys
                                                                                          fill={
                                                                                               entry.fill
                                                                                          }
                                                                                     />
                                                                                )
                                                                           )}
                                                                           <Label
                                                                                content={({ viewBox }) =>
                                                                                     getLabelContent(viewBox, totalNotes, isMobileView, isTabletView)
                                                                                }
                                                                           />
                                                                      </Pie>
                                                                 </PieChart>
                                                            </ResponsiveContainer>
                                                       </ChartContainer>
                                                  </div>
                                             ) : (
                                                  <div className="text-sm text-gray-500">
                                                       No status data available
                                                  </div>
                                             )}
                                        </CardContent>
                                        <CardFooter className="flex-col gap-2 text-sm">
                                             <div className="leading-none text-muted-foreground">
                                                  Distribution of notes by their
                                                  current status
                                             </div>
                                        </CardFooter>
                                   </Card>

                                   <Card className="flex flex-col">
                                        <CardHeader>
                                             <CardTitle className="flex items-center gap-2 text-lg">
                                                  <Activity className="w-5 h-5 text-indigo-500" />
                                                  Notes per Day
                                             </CardTitle>
                                             <CardDescription>
                                                  Historical note creation
                                                  activity
                                             </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1">
                                             {barChartData.length > 0 ? (
                                                  <div className="w-full h-[250px] md:h-[300px]">
                                                       <ChartContainer
                                                            config={
                                                                 barChartConfig
                                                            }
                                                            className="w-full h-full"
                                                       >
                                                            <ResponsiveContainer
                                                                 width="100%"
                                                                 height="100%"
                                                            >
                                                                 <BarChart
                                                                      data={
                                                                           barChartData
                                                                      }
                                                                      accessibilityLayer
                                                                      margin={{
                                                                           top: 10,
                                                                           right: 10,
                                                                           left: isMobileView
                                                                                ? 5
                                                                                : 20,
                                                                           bottom: 20,
                                                                      }}
                                                                 >
                                                                      <CartesianGrid
                                                                           vertical={
                                                                                false
                                                                           }
                                                                           strokeDasharray="3 3"
                                                                      />
                                                                      <XAxis
                                                                           dataKey="date"
                                                                           tickLine={
                                                                                false
                                                                           }
                                                                           axisLine={
                                                                                false
                                                                           }
                                                                           tickMargin={
                                                                                10
                                                                           }
                                                                           tickFormatter={(
                                                                                value
                                                                           ) => {
                                                                                try {
                                                                                     const date =
                                                                                          new Date(
                                                                                               value
                                                                                          );
                                                                                     // Check if date is valid
                                                                                     if (
                                                                                          isNaN(
                                                                                               date.getTime()
                                                                                          )
                                                                                     ) {
                                                                                          return value; // Return original value if parsing fails
                                                                                     }
                                                                                     // Use simplified format on mobile
                                                                                     return isMobileView
                                                                                          ? date.toLocaleDateString(
                                                                                               undefined,
                                                                                               {
                                                                                                    day: "numeric",
                                                                                               }
                                                                                          )
                                                                                          : date.toLocaleDateString(
                                                                                               undefined,
                                                                                               {
                                                                                                    month: "short",
                                                                                                    day: "numeric",
                                                                                               }
                                                                                          );
                                                                                } catch (err) {
                                                                                     console.error(
                                                                                          "Error formatting date:",
                                                                                          err
                                                                                     );
                                                                                     return value;
                                                                                }
                                                                           }}
                                                                           // Use calculated interval
                                                                           interval={
                                                                                getResponsiveTickInterval
                                                                           }
                                                                      />
                                                                      <YAxis
                                                                           tickLine={
                                                                                false
                                                                           }
                                                                           axisLine={
                                                                                false
                                                                           }
                                                                           tickMargin={
                                                                                isMobileView
                                                                                     ? 5
                                                                                     : 10
                                                                           }
                                                                           width={
                                                                                isMobileView
                                                                                     ? 25
                                                                                     : 40
                                                                           }
                                                                           allowDecimals={
                                                                                false
                                                                           }
                                                                      />
                                                                      <ChartTooltip
                                                                           cursor={{
                                                                                fill: "rgba(0, 0, 0, 0.1)",
                                                                           }}
                                                                           content={
                                                                                <ChartTooltipContent
                                                                                     labelFormatter={(
                                                                                          value
                                                                                     ) => {
                                                                                          try {
                                                                                               const date =
                                                                                                    new Date(
                                                                                                         value
                                                                                                    );
                                                                                               if (
                                                                                                    isNaN(
                                                                                                         date.getTime()
                                                                                                    )
                                                                                               ) {
                                                                                                    return value;
                                                                                               }
                                                                                               return date.toLocaleDateString(
                                                                                                    undefined,
                                                                                                    {
                                                                                                         year: "numeric",
                                                                                                         month: "long",
                                                                                                         day: "numeric",
                                                                                                    }
                                                                                               );
                                                                                          } catch (err) {
                                                                                               return err;
                                                                                          }
                                                                                     }}
                                                                                />
                                                                           }
                                                                      />
                                                                      <Bar
                                                                           dataKey="count"
                                                                           name="Number of Notes"
                                                                           fill="var(--color-status-0)"
                                                                           radius={[
                                                                                4,
                                                                                4,
                                                                                0,
                                                                                0,
                                                                           ]}
                                                                           minPointSize={
                                                                                3
                                                                           }
                                                                      />
                                                                 </BarChart>
                                                            </ResponsiveContainer>
                                                       </ChartContainer>
                                                  </div>
                                             ) : (
                                                  <div className="text-sm text-gray-500">
                                                       No note data available
                                                  </div>
                                             )}
                                        </CardContent>
                                        <CardFooter className="flex-col gap-2 text-sm">
                                             <div className="leading-none text-muted-foreground">
                                                  Number of notes created per
                                                  day
                                             </div>
                                        </CardFooter>
                                   </Card>
                              </>
                         )}
                    </div>
               </ScrollArea>
          </div>
     );
};

export default Dash;
